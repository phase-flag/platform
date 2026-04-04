# frozen_string_literal: true

require "net/http"
require "uri"
require "json"
require "logger"
require "time"

module PhaseFlag
  # Feature flag client with local evaluation, background polling, and event
  # batching.
  #
  # @example Basic usage
  #   client = PhaseFlag::Client.new(
  #     base_url: "https://api.example.com/api/v1",
  #     api_key:  "your-api-key"
  #   )
  #   client.start
  #   client.wait_until_ready
  #
  #   if client.get_boolean_value("dark-mode", false)
  #     enable_dark_mode
  #   end
  #
  #   client.stop
  class Client
    # @return [Logger] Logger instance for the client.
    attr_reader :logger

    # @param base_url             [String]  Base URL of the PhaseFlag API.
    # @param api_key              [String]  API key for authentication.
    # @param polling_interval     [Numeric] Seconds between ruleset polls (default: 30).
    # @param event_flush_interval [Numeric] Seconds between event flushes (default: 30).
    # @param event_batch_size     [Integer] Max queued events before auto-flush (default: 100).
    def initialize(base_url:, api_key:, polling_interval: 30, event_flush_interval: 30, event_batch_size: 100)
      @base_url             = base_url.chomp("/")
      @api_key              = api_key
      @polling_interval     = polling_interval
      @event_flush_interval = event_flush_interval
      @event_batch_size     = event_batch_size

      @logger = Logger.new($stdout, progname: "PhaseFlag")
      @logger.level = Logger::WARN

      # Flag store (protected by @flag_mutex)
      @flags      = {}
      @flag_mutex = Mutex.new

      # Readiness
      @ready       = false
      @ready_mutex = Mutex.new
      @ready_cv    = ConditionVariable.new

      # Event queue (protected by @event_mutex)
      @event_queue = []
      @event_mutex = Mutex.new

      # Change listeners (protected by @listener_mutex)
      @listeners      = []
      @listener_mutex = Mutex.new

      # Background threads
      @polling_thread = nil
      @flush_thread   = nil
      @stop_flag      = false
      @stop_mutex     = Mutex.new
      @stop_cv        = ConditionVariable.new
    end

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    # Fetch the initial ruleset and start background polling and event
    # flushing threads.
    #
    # @return [void]
    def start
      fetch_ruleset

      @stop_mutex.synchronize { @stop_flag = false }

      @polling_thread = Thread.new { polling_loop }
      @polling_thread.name = "phaseflag-polling" if @polling_thread.respond_to?(:name=)

      @flush_thread = Thread.new { flush_loop }
      @flush_thread.name = "phaseflag-flush" if @flush_thread.respond_to?(:name=)
    end

    # Stop background threads and flush any remaining events.
    #
    # @return [void]
    def stop
      @stop_mutex.synchronize do
        @stop_flag = true
        @stop_cv.broadcast
      end

      @polling_thread&.join(5)
      @polling_thread = nil

      @flush_thread&.join(5)
      @flush_thread = nil

      # Final flush
      begin
        flush_events
      rescue StandardError => e
        @logger.warn("Failed to flush events during shutdown: #{e.message}")
      end
    end

    # Block until the first ruleset fetch completes.
    #
    # @param timeout [Numeric] Maximum seconds to wait (default: 10).
    # @return [Boolean] +true+ if the client became ready within the timeout.
    def wait_until_ready(timeout: 10)
      deadline = Time.now + timeout
      @ready_mutex.synchronize do
        until @ready
          remaining = deadline - Time.now
          return false if remaining <= 0

          @ready_cv.wait(@ready_mutex, remaining)
        end
        true
      end
    end

    # Whether the client has successfully fetched at least one ruleset.
    #
    # @return [Boolean]
    def ready?
      @ready_mutex.synchronize { @ready }
    end

    # ------------------------------------------------------------------
    # Local evaluation
    # ------------------------------------------------------------------

    # Evaluate a boolean flag locally.
    #
    # @param flag_key      [String]             The flag key.
    # @param default_value [Boolean]            Value returned when the flag is
    #                                           not found or not boolean.
    # @param context       [EvaluationContext, nil] Optional evaluation context.
    # @return [Boolean]
    def get_boolean_value(flag_key, default_value, context: nil)
      result = resolve(flag_key, context)
      return default_value if result.nil?
      return default_value unless result.value == true || result.value == false

      result.value
    end

    # Evaluate a string flag locally.
    #
    # @param flag_key      [String]
    # @param default_value [String]
    # @param context       [EvaluationContext, nil]
    # @return [String]
    def get_string_value(flag_key, default_value, context: nil)
      result = resolve(flag_key, context)
      return default_value if result.nil?
      return default_value unless result.value.is_a?(String)

      result.value
    end

    # Evaluate a JSON (arbitrary) flag locally.
    #
    # @param flag_key      [String]
    # @param default_value [Object]
    # @param context       [EvaluationContext, nil]
    # @return [Object]
    def get_json_value(flag_key, default_value, context: nil)
      result = resolve(flag_key, context)
      return default_value if result.nil?

      result.value
    end

    # Get the full evaluation result for a flag, or +nil+.
    #
    # @param flag_key [String]
    # @param context  [EvaluationContext, nil]
    # @return [EvaluationResult, nil]
    def get_variation(flag_key, context: nil)
      resolve(flag_key, context)
    end

    # Return all currently loaded flag definitions.
    #
    # @return [Array<FlagDefinition>]
    def get_all_flags
      @flag_mutex.synchronize { @flags.values }
    end

    # ------------------------------------------------------------------
    # Remote evaluation
    # ------------------------------------------------------------------

    # Evaluate a flag server-side via +POST /evaluate+.
    #
    # Useful when targeting rules require server-side data that the SDK
    # does not have locally.
    #
    # @param flag_key [String]
    # @param context  [EvaluationContext, nil]
    # @return [EvaluationResult]
    def evaluate(flag_key, context: nil)
      ctx     = context || EvaluationContext.new
      payload = { "flag_key" => flag_key, "context" => ctx.to_h }

      data = http_post("/evaluate", payload)

      EvaluationResult.new(
        flag_key:      data["flag_key"] || flag_key,
        variation_id:  data["variation_id"],
        variation_key: data["variation_key"],
        value:         data["value"],
        reason:        data["reason"] || "default"
      )
    end

    # ------------------------------------------------------------------
    # Event tracking
    # ------------------------------------------------------------------

    # Queue an evaluation event for later batched submission.
    #
    # Events are flushed automatically on a periodic interval, when the
    # batch size threshold is reached, or when {#stop} is called.
    #
    # @param flag_key       [String]
    # @param variation_key  [String, nil]
    # @param user_id        [String, nil]
    # @param timestamp      [String, nil] ISO 8601 timestamp; auto-generated if nil.
    # @param metadata       [Hash]
    # @return [void]
    def track_event(flag_key:, variation_key: nil, user_id: nil, timestamp: nil, metadata: {})
      event = EvaluationEvent.new(
        flag_key:      flag_key,
        variation_key: variation_key,
        user_id:       user_id,
        timestamp:     timestamp || Time.now.utc.iso8601,
        metadata:      metadata
      )

      flush_now = false
      @event_mutex.synchronize do
        @event_queue << event
        flush_now = @event_queue.size >= @event_batch_size
      end

      flush_events if flush_now
    end

    # Send all queued events to +POST /sdk/events+ immediately.
    #
    # @return [void]
    def flush_events
      batch = nil
      @event_mutex.synchronize do
        return if @event_queue.empty?

        batch = @event_queue.dup
        @event_queue.clear
      end

      payload = { "events" => batch.map(&:to_h) }

      begin
        http_post("/sdk/events", payload)
        @logger.debug("Flushed #{batch.size} events")
      rescue StandardError => e
        @logger.warn("Failed to flush #{batch.size} events; re-enqueuing: #{e.message}")
        @event_mutex.synchronize do
          @event_queue = batch + @event_queue
        end
      end
    end

    # ------------------------------------------------------------------
    # Change listeners
    # ------------------------------------------------------------------

    # Register a callback invoked whenever the flag set changes.
    #
    # @yield [flags] Called with the current flags hash.
    # @yieldparam flags [Hash{String => FlagDefinition}]
    # @return [Proc] A proc that, when called, removes the listener.
    def on_flags_changed(&block)
      @listener_mutex.synchronize { @listeners << block }

      proc do
        @listener_mutex.synchronize { @listeners.delete(block) }
      end
    end

    private

    # ------------------------------------------------------------------
    # Internal resolution
    # ------------------------------------------------------------------

    def resolve(flag_key, context)
      flag = @flag_mutex.synchronize { @flags[flag_key] }
      return nil if flag.nil?

      ctx = context || EvaluationContext.new
      Evaluator.evaluate(flag, ctx)
    end

    # ------------------------------------------------------------------
    # Ruleset fetching
    # ------------------------------------------------------------------

    def fetch_ruleset
      data = http_get("/sdk/ruleset")

      new_flags = {}
      (data["flags"] || []).each do |raw|
        flag = parse_flag(raw)
        new_flags[flag.key] = flag
      end

      @flag_mutex.synchronize { @flags = new_flags }

      # Mark ready after first successful fetch.
      @ready_mutex.synchronize do
        @ready = true
        @ready_cv.broadcast
      end

      notify_listeners

      @logger.debug("Fetched ruleset: #{new_flags.size} flags")
    rescue StandardError => e
      @logger.warn("Failed to fetch ruleset: #{e.message}")
      # Stale flags are better than no flags -- keep the old cache.
    end

    # ------------------------------------------------------------------
    # Listener notification
    # ------------------------------------------------------------------

    def notify_listeners
      listeners = @listener_mutex.synchronize { @listeners.dup }
      snapshot  = @flag_mutex.synchronize { @flags.dup }

      listeners.each do |listener|
        begin
          listener.call(snapshot)
        rescue StandardError => e
          @logger.warn("Flag change listener raised an exception: #{e.message}")
        end
      end
    end

    # ------------------------------------------------------------------
    # Background loops
    # ------------------------------------------------------------------

    def polling_loop
      loop do
        @stop_mutex.synchronize do
          @stop_cv.wait(@stop_mutex, @polling_interval)
          return if @stop_flag
        end

        fetch_ruleset
      end
    end

    def flush_loop
      loop do
        @stop_mutex.synchronize do
          @stop_cv.wait(@stop_mutex, @event_flush_interval)
          return if @stop_flag
        end

        begin
          flush_events
        rescue StandardError => e
          @logger.warn("Periodic event flush failed: #{e.message}")
        end
      end
    end

    # ------------------------------------------------------------------
    # HTTP helpers (Net::HTTP, stdlib only)
    # ------------------------------------------------------------------

    def http_get(path)
      uri = URI.parse("#{@base_url}#{path}")
      req = Net::HTTP::Get.new(uri)
      req["Content-Type"] = "application/json"
      req["X-API-Key"]    = @api_key

      response = perform_request(uri, req)
      handle_response(response)
    end

    def http_post(path, body)
      uri = URI.parse("#{@base_url}#{path}")
      req = Net::HTTP::Post.new(uri)
      req["Content-Type"] = "application/json"
      req["X-API-Key"]    = @api_key
      req.body            = JSON.generate(body)

      response = perform_request(uri, req)
      handle_response(response)
    end

    def perform_request(uri, req)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl     = (uri.scheme == "https")
      http.open_timeout = 10
      http.read_timeout = 10
      http.request(req)
    end

    def handle_response(response)
      unless response.is_a?(Net::HTTPSuccess)
        raise "HTTP #{response.code}: #{response.body}"
      end

      JSON.parse(response.body)
    end

    # ------------------------------------------------------------------
    # Parsing helpers: raw API hashes -> model structs
    # ------------------------------------------------------------------

    def parse_variation(raw)
      Variation.new(
        id:          raw["id"],
        key:         raw["key"],
        name:        raw["name"] || raw["key"],
        value:       raw["value"],
        description: raw["description"]
      )
    end

    def parse_targeting_condition(raw)
      TargetingCondition.new(
        attribute: raw["attribute"] || "",
        operator:  raw["operator"]  || "",
        value:     raw["value"]
      )
    end

    def parse_percentage_rollout(raw)
      return nil if raw.nil?

      entries = (raw["variations"] || []).map do |e|
        PercentageRolloutEntry.new(
          variation_id: e["variation_id"] || "",
          weight:       e["weight"] || 0
        )
      end

      PercentageRollout.new(variations: entries)
    end

    def parse_targeting_rule(raw)
      conditions = (raw["conditions"] || []).map { |c| parse_targeting_condition(c) }

      TargetingRule.new(
        priority:           raw["priority"] || 0,
        conditions:         conditions,
        variation_id:       raw["variation_id"],
        percentage_rollout: parse_percentage_rollout(raw["percentage_rollout"]),
        segment_id:         raw["segment_id"]
      )
    end

    def parse_flag(raw)
      FlagDefinition.new(
        id:                   raw["id"],
        key:                  raw["key"],
        name:                 raw["name"] || raw["key"],
        flag_type:            raw["flag_type"] || "boolean",
        status:               raw["status"] || "active",
        environment:          raw["environment"] || "development",
        default_variation_id: raw["default_variation_id"] || "",
        variations:           (raw["variations"] || []).map { |v| parse_variation(v) },
        targeting_rules:      (raw["targeting_rules"] || []).map { |r| parse_targeting_rule(r) },
        tags:                 raw["tags"] || []
      )
    end
  end
end
