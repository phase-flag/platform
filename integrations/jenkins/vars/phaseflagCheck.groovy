/**
 * Phase Flag — Jenkins Shared Library Step: phaseflagCheck
 *
 * Checks whether a Phase Flag feature flag is enabled.
 * Returns the flag's enabled state as a Boolean.
 *
 * Usage:
 *   def isEnabled = phaseflagCheck(
 *     apiUrl: 'https://api.phaseflag.io',
 *     apiKey: env.PHASEFLAG_API_KEY,
 *     flagKey: 'enable-new-checkout'
 *   )
 *   if (!isEnabled) {
 *     error("Flag is disabled — aborting deployment")
 *   }
 *
 * @param apiUrl   Phase Flag API base URL
 * @param apiKey   Phase Flag API key (use a Jenkins credential)
 * @param flagKey  The feature flag key to check
 * @return Boolean — true if the flag is enabled, false otherwise
 */
Boolean call(Map args) {
    def apiUrl = args.apiUrl ?: env.PHASEFLAG_API_URL
    def apiKey  = args.apiKey  ?: env.PHASEFLAG_API_KEY
    def flagKey = args.flagKey

    if (!apiUrl) {
        error("[phaseflagCheck] apiUrl / PHASEFLAG_API_URL is required")
    }
    if (!apiKey) {
        error("[phaseflagCheck] apiKey / PHASEFLAG_API_KEY is required")
    }
    if (!flagKey) {
        error("[phaseflagCheck] flagKey is required")
    }

    echo "[phaseflagCheck] Checking flag: ${flagKey}"

    def response = _pfRequest(
        method:  'GET',
        apiUrl:  apiUrl,
        apiKey:  apiKey,
        path:    "/api/v1/flags/${flagKey}"
    )

    def enabled = response?.enabled?.toString()?.toLowerCase() == 'true'
    echo "[phaseflagCheck] Flag '${flagKey}' enabled=${enabled}"
    return enabled
}

// ---------------------------------------------------------------------------
// phaseflagToggle — toggle a flag on or off
//
// Usage:
//   phaseflagToggle(
//     apiUrl:  'https://api.phaseflag.io',
//     apiKey:  env.PHASEFLAG_API_KEY,
//     flagKey: 'enable-new-checkout',
//     enabled: true
//   )
// ---------------------------------------------------------------------------
def toggle(Map args) {
    def apiUrl  = args.apiUrl  ?: env.PHASEFLAG_API_URL
    def apiKey  = args.apiKey  ?: env.PHASEFLAG_API_KEY
    def flagKey = args.flagKey
    def enabled = args.containsKey('enabled') ? args.enabled : true

    if (!apiUrl)  { error("[phaseflagCheck.toggle] apiUrl is required") }
    if (!apiKey)  { error("[phaseflagCheck.toggle] apiKey is required") }
    if (!flagKey) { error("[phaseflagCheck.toggle] flagKey is required") }

    echo "[phaseflagCheck] Toggling flag '${flagKey}' to enabled=${enabled}"

    def body = groovy.json.JsonOutput.toJson([enabled: enabled])

    def response = _pfRequest(
        method:  'PATCH',
        apiUrl:  apiUrl,
        apiKey:  apiKey,
        path:    "/api/v1/flags/${flagKey}",
        body:    body
    )

    echo "[phaseflagCheck] Flag '${flagKey}' toggled successfully."
    return response
}

// ---------------------------------------------------------------------------
// archive — archive a flag after its feature is fully rolled out
//
// Usage:
//   phaseflagCheck.archive(
//     apiUrl:  'https://api.phaseflag.io',
//     apiKey:  env.PHASEFLAG_API_KEY,
//     flagKey: 'enable-new-checkout'
//   )
// ---------------------------------------------------------------------------
def archive(Map args) {
    def apiUrl  = args.apiUrl  ?: env.PHASEFLAG_API_URL
    def apiKey  = args.apiKey  ?: env.PHASEFLAG_API_KEY
    def flagKey = args.flagKey

    if (!apiUrl)  { error("[phaseflagCheck.archive] apiUrl is required") }
    if (!apiKey)  { error("[phaseflagCheck.archive] apiKey is required") }
    if (!flagKey) { error("[phaseflagCheck.archive] flagKey is required") }

    echo "[phaseflagCheck] Archiving flag: ${flagKey}"

    def response = _pfRequest(
        method: 'POST',
        apiUrl: apiUrl,
        apiKey: apiKey,
        path:   "/api/v1/flags/${flagKey}/archive",
        body:   '{}'
    )

    echo "[phaseflagCheck] Flag '${flagKey}' archived successfully."
    return response
}

// ---------------------------------------------------------------------------
// Internal helper — performs an HTTP request using the httpRequest plugin
// if available, otherwise falls back to curl via sh.
// ---------------------------------------------------------------------------
private Map _pfRequest(Map args) {
    def method = args.method ?: 'GET'
    def url    = "${args.apiUrl}${args.path}"
    def body   = args.body ?: ''

    // Attempt to use the Jenkins HTTP Request plugin (preferred)
    try {
        def resp = httpRequest(
            url:                url,
            httpMode:           method,
            customHeaders:      [[name: 'Authorization', value: "Bearer ${args.apiKey}", maskValue: true],
                                 [name: 'Content-Type',  value: 'application/json']],
            requestBody:        body,
            validResponseCodes: '200:299',
            consoleLogResponseBody: false
        )
        def parsed = readJSON(text: resp.content)
        return parsed
    } catch (ClassNotFoundException | NoClassDefFoundError ignored) {
        // HTTP Request plugin not installed — fall back to curl
    }

    // Fallback: curl
    def curlCmd = """
        curl --silent --fail \\
          --request ${method} \\
          --header 'Content-Type: application/json' \\
          ${body ? "--data '${body}'" : ''} \\
          --output /tmp/pf_response.json \\
          "${url}"
    """

    withCredentials([string(credentialsId: '', variable: '_UNUSED')]) {
        // Note: inject apiKey via Jenkins credential binding in your Jenkinsfile
        // rather than passing it as a plain string.
    }

    def status = sh(
        script: """
            curl --silent --fail \\
              --request ${method} \\
              --header "Authorization: Bearer ${args.apiKey}" \\
              --header "Content-Type: application/json" \\
              ${body ? "--data '${body}'" : ''} \\
              --output /tmp/pf_response.json \\
              "${url}" && echo 0 || echo \$?
        """,
        returnStdout: true
    ).trim()

    if (status != '0') {
        error("[phaseflagCheck] curl request failed (status=${status}) for ${url}")
    }

    def content = readFile('/tmp/pf_response.json')
    return readJSON(text: content)
}
