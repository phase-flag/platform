export default function Privacy() {
  return (
    <div className="bg-[#0B0F1A] min-h-screen pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <a
            href="#"
            className="inline-flex items-center gap-2 text-sm text-[#6366F1] hover:text-white transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </a>
          <h1 className="text-4xl font-heading font-light text-white tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-white/50 text-sm">Effective date: April 1, 2026 &nbsp;·&nbsp; Last updated: April 1, 2026</p>
        </div>

        <div className="prose-legal">
          <p className="intro-note">
            Hextrot (doing business as <strong>Phase Flag</strong>) is committed to protecting your privacy. This
            Privacy Policy explains how we collect, use, and share information about you when you use our services.
            We are the data controller for personal data processed under this policy.
          </p>

          <Section title="1. Information We Collect">
            <h3>Account Data</h3>
            <p>
              When you register for an account, we collect your name, email address, company name, and password
              (stored as a secure hash). We also collect billing information (processed by Stripe — we do not store
              full card numbers) and any profile information you choose to provide.
            </p>
            <h3>Usage Data</h3>
            <p>
              We automatically collect information about how you interact with our Service, including pages visited,
              features used, API calls made, evaluation events, browser type, operating system, IP address,
              referring URLs, and timestamps. This data is used to operate, improve, and secure the Service.
            </p>
            <h3>Cookies and Tracking Technologies</h3>
            <p>
              We use cookies, local storage, and similar technologies to maintain your session, remember your
              preferences, and gather analytics. See the &ldquo;Cookies&rdquo; section below for details.
            </p>
          </Section>

          <Section title="2. How We Use Information">
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve the Service</li>
              <li>Process payments and manage your subscription</li>
              <li>Send transactional emails (account verification, invoices, security alerts)</li>
              <li>Respond to support requests and inquiries</li>
              <li>Send product updates and marketing communications (you may opt out at any time)</li>
              <li>Monitor and enforce compliance with our Terms of Service</li>
              <li>Protect against fraud, abuse, and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>
              We rely on the following legal bases under GDPR for processing your data: contract performance
              (providing the Service), legitimate interests (security, fraud prevention, analytics), legal
              obligation, and consent (marketing emails, non-essential cookies).
            </p>
          </Section>

          <Section title="3. Data Retention">
            <p>
              We retain your personal data for as long as your account is active or as needed to provide the Service.
              Account data is deleted within 30 days of account termination upon request. Usage and evaluation event
              data may be retained in aggregated, anonymized form beyond this period for statistical purposes.
            </p>
            <p>
              Billing records are retained for up to 7 years as required by applicable tax and accounting
              regulations.
            </p>
          </Section>

          <Section title="4. Your Rights (GDPR)">
            <p>
              If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have the
              following rights regarding your personal data:
            </p>
            <ul>
              <li>
                <strong>Access:</strong> You may request a copy of the personal data we hold about you.
              </li>
              <li>
                <strong>Rectification:</strong> You may ask us to correct inaccurate or incomplete data.
              </li>
              <li>
                <strong>Erasure:</strong> You may request deletion of your personal data (&ldquo;right to be
                forgotten&rdquo;), subject to legal retention requirements.
              </li>
              <li>
                <strong>Data Portability:</strong> You may request your data in a structured, machine-readable
                format to transfer to another service.
              </li>
              <li>
                <strong>Objection:</strong> You may object to processing based on legitimate interests or for
                direct marketing purposes.
              </li>
              <li>
                <strong>Restriction:</strong> You may request that we restrict processing of your data in certain
                circumstances.
              </li>
              <li>
                <strong>Withdraw Consent:</strong> Where processing is based on consent, you may withdraw it at
                any time without affecting prior lawful processing.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@phaseflag.com" className="text-[#6366F1] hover:text-white transition-colors">
                privacy@phaseflag.com
              </a>
              . We will respond within 30 days. You also have the right to lodge a complaint with your local data
              protection authority.
            </p>
          </Section>

          <Section title="5. Cookies">
            <p>We use the following categories of cookies:</p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Purpose</th>
                    <th>Consent Required</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Essential</td>
                    <td>Authentication sessions, security tokens, load balancing</td>
                    <td>No</td>
                  </tr>
                  <tr>
                    <td>Functional</td>
                    <td>User preferences, language settings, UI state</td>
                    <td>No</td>
                  </tr>
                  <tr>
                    <td>Analytics</td>
                    <td>Aggregate usage statistics to improve the Service</td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Marketing</td>
                    <td>Personalized content and advertising (if enabled)</td>
                    <td>Yes</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              You can manage cookie preferences through our consent banner or your browser settings. Note that
              disabling essential cookies may affect Service functionality.
            </p>
          </Section>

          <Section title="6. Third-Party Services">
            <p>We share data with the following third parties to operate the Service:</p>
            <ul>
              <li>
                <strong>Stripe</strong> — Payment processing. Stripe handles card data under their own privacy
                policy and PCI-DSS compliance. We receive only tokenized payment references.
              </li>
              <li>
                <strong>Cloud infrastructure providers</strong> — Our API, database, and storage run on
                infrastructure that meets SOC 2 Type II and ISO 27001 standards.
              </li>
              <li>
                <strong>Email providers</strong> — Transactional and notification emails are sent via a
                third-party email delivery service.
              </li>
            </ul>
            <p>
              We do not sell your personal data to third parties. We require all sub-processors to maintain
              appropriate data protection standards.
            </p>
          </Section>

          <Section title="7. Data Security">
            <p>
              We implement technical and organizational measures to protect your data, including encryption in
              transit (TLS 1.2+), encryption at rest, access controls, audit logging, and regular security reviews.
            </p>
            <p>
              Despite these measures, no method of transmission over the Internet is 100% secure. If we become
              aware of a data breach that affects your personal data, we will notify you and relevant authorities
              as required by applicable law.
            </p>
          </Section>

          <Section title="8. International Transfers">
            <p>
              We may transfer your personal data to countries outside the EEA where our infrastructure or
              sub-processors are located. When we do so, we ensure adequate safeguards are in place, such as
              Standard Contractual Clauses (SCCs) approved by the European Commission or equivalent mechanisms.
            </p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              The Service is not directed to children under the age of 16 (or the applicable age of digital consent
              in your jurisdiction). We do not knowingly collect personal data from children. If you believe we have
              inadvertently collected such data, please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting
              the updated policy on this page with a new effective date, and where appropriate by email. We encourage
              you to review this policy periodically.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For any privacy-related questions, requests, or concerns, please contact our Data Protection team:
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 mt-3 text-sm text-white/70 space-y-1">
              <p><strong className="text-white">Hextrot</strong> (dba Phase Flag) — Data Controller</p>
              <p>
                Email:{' '}
                <a href="mailto:privacy@phaseflag.com" className="text-[#6366F1] hover:text-white transition-colors">
                  privacy@phaseflag.com
                </a>
              </p>
            </div>
          </Section>
        </div>
      </div>

      <style>{`
        .prose-legal .intro-note {
          color: rgba(255,255,255,0.65);
          font-size: 0.975rem;
          line-height: 1.75;
          margin-bottom: 1.5rem;
          padding: 1rem 1.25rem;
          background: rgba(99,102,241,0.07);
          border-left: 3px solid #6366F1;
          border-radius: 0 0.5rem 0.5rem 0;
        }
        .prose-legal h2 {
          color: #ffffff;
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 2.5rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .prose-legal h3 {
          color: rgba(255,255,255,0.85);
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 1.25rem;
          margin-bottom: 0.4rem;
        }
        .prose-legal p {
          color: rgba(255,255,255,0.65);
          font-size: 0.925rem;
          line-height: 1.75;
          margin-bottom: 0.85rem;
        }
        .prose-legal strong {
          color: rgba(255,255,255,0.9);
          font-weight: 600;
        }
        .prose-legal ul {
          color: rgba(255,255,255,0.65);
          font-size: 0.925rem;
          line-height: 1.75;
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.85rem;
        }
        .prose-legal li {
          margin-bottom: 0.35rem;
        }
        .prose-legal table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }
        .prose-legal th {
          text-align: left;
          padding: 0.6rem 0.75rem;
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.8);
          font-weight: 600;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .prose-legal td {
          padding: 0.6rem 0.75rem;
          color: rgba(255,255,255,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          vertical-align: top;
        }
        .prose-legal tr:last-child td {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
