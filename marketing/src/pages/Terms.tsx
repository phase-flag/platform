export default function Terms() {
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
            Terms of Service
          </h1>
          <p className="text-white/50 text-sm">Effective date: April 1, 2026 &nbsp;·&nbsp; Last updated: April 1, 2026</p>
        </div>

        <div className="prose-legal">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using the Phase Flag platform (the &ldquo;Service&rdquo;), you agree to be bound by these
              Terms of Service (&ldquo;Terms&rdquo;). The Service is operated by Hextrot (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
              &ldquo;our&rdquo;), a company doing business as <strong>Phase Flag</strong>. If you are entering into these Terms
              on behalf of an organization, you represent that you have the authority to bind that organization.
            </p>
            <p>
              If you do not agree to these Terms, do not access or use the Service. We may update these Terms at any
              time; continued use of the Service after changes are posted constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Phase Flag is a feature flag management platform that enables software teams to control feature releases,
              run A/B experiments, and manage configuration without code deployments. The Service includes:
            </p>
            <ul>
              <li>A hosted API for flag evaluation and management</li>
              <li>A web-based administration dashboard</li>
              <li>Client and server SDKs for multiple programming languages</li>
              <li>An edge relay proxy for low-latency evaluations</li>
              <li>Optional self-hosted open-source components licensed under the Apache 2.0 License</li>
            </ul>
            <p>
              Features available to you depend on your subscription plan. We reserve the right to modify, suspend,
              or discontinue any feature of the Service with reasonable notice.
            </p>
          </Section>

          <Section title="3. Account Terms">
            <p>
              To use the Service you must register for an account. You agree to provide accurate, current, and
              complete information and to keep it updated. You are responsible for maintaining the confidentiality of
              your credentials and for all activity that occurs under your account.
            </p>
            <p>
              You must be at least 18 years of age or the age of legal majority in your jurisdiction. Accounts may not
              be shared, sold, or transferred without our written consent. You must notify us immediately of any
              unauthorized access or breach of security.
            </p>
            <p>
              We may suspend or terminate accounts that violate these Terms, exhibit fraudulent activity, or remain
              inactive for an extended period without notice.
            </p>
          </Section>

          <Section title="4. API Usage">
            <p>
              Access to the Phase Flag API is subject to usage limits defined by your subscription plan. You agree not
              to exceed your plan&apos;s rate limits. Excessive or abusive usage that degrades service performance for
              other customers may result in temporary throttling or account suspension.
            </p>
            <p>
              API keys and SDK keys are confidential credentials. You are responsible for their security. Do not
              expose keys in publicly accessible code repositories or client-side code without appropriate scoping.
              We are not liable for unauthorized usage resulting from exposed credentials.
            </p>
            <p>
              You may not use the API to build a competing feature flag platform, resell API access, or circumvent
              billing or access controls.
            </p>
          </Section>

          <Section title="5. Payment Terms">
            <p>
              Paid plans are billed in advance on a monthly or annual basis. All fees are non-refundable except as
              required by law or as explicitly stated in our refund policy. Prices are listed in US dollars and
              exclude applicable taxes unless otherwise stated.
            </p>
            <p>
              Payment is processed by Stripe. By subscribing, you authorize us to charge your payment method on each
              billing cycle. If payment fails, we will attempt to notify you and may downgrade or suspend your account
              after a grace period.
            </p>
            <p>
              We reserve the right to change pricing with at least 30 days&apos; notice. Price changes will not affect
              your current billing period.
            </p>
          </Section>

          <Section title="6. Data Ownership">
            <p>
              You retain all ownership of data you submit to the Service, including flag configurations, user
              attributes, evaluation events, and experiment results (&ldquo;Customer Data&rdquo;). We claim no intellectual
              property rights over your Customer Data.
            </p>
            <p>
              You grant us a limited license to store, process, and transmit Customer Data solely to operate and
              improve the Service. We will not share your Customer Data with third parties except as described in our
              Privacy Policy or as required by law.
            </p>
            <p>
              Upon termination, you may export your data for up to 30 days. After that period, we may delete Customer
              Data from our systems.
            </p>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Violate any applicable law, regulation, or third-party rights</li>
              <li>Transmit malware, viruses, or destructive code</li>
              <li>Conduct unauthorized penetration testing or security scanning of our infrastructure</li>
              <li>Harvest or collect personal data about other users without consent</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Attempt to gain unauthorized access to any system, account, or network</li>
              <li>Use the Service for cryptocurrency mining or similar resource-intensive tasks unrelated to feature management</li>
            </ul>
            <p>
              We reserve the right to investigate and take appropriate action against violations, including removal of
              content, account suspension, and referral to law enforcement.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              You may terminate your account at any time by contacting us or using the account deletion feature in
              your dashboard. Termination does not entitle you to a refund of prepaid fees.
            </p>
            <p>
              We may terminate or suspend your access immediately, without prior notice, for cause including but not
              limited to a breach of these Terms, non-payment, or conduct harmful to the Service or other users.
            </p>
            <p>
              Provisions of these Terms that by their nature should survive termination will remain in effect,
              including ownership provisions, disclaimers, limitations of liability, and dispute resolution.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, Hextrot shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or
              business interruption, arising from your use of or inability to use the Service.
            </p>
            <p>
              Our total cumulative liability for any claims arising under these Terms shall not exceed the greater of
              (a) the amount you paid us in the 12 months preceding the claim or (b) $100 USD.
            </p>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or
              implied, including but not limited to merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
          </Section>

          <Section title="10. Changes to Terms">
            <p>
              We may modify these Terms at any time. We will provide at least 14 days&apos; advance notice of material
              changes by posting the updated Terms on this page and, where practicable, by sending an email to the
              address associated with your account.
            </p>
            <p>
              Your continued use of the Service after the effective date of revised Terms constitutes your acceptance.
              If you do not agree to the changes, you must stop using the Service before the effective date.
            </p>
          </Section>

          <Section title="11. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the laws of the jurisdiction in which
              Hextrot is incorporated, without regard to conflict of law principles. Any disputes arising under these
              Terms shall be submitted to the exclusive jurisdiction of the courts in that jurisdiction.
            </p>
            <p>
              If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in
              full force and effect.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 mt-3 text-sm text-white/70 space-y-1">
              <p><strong className="text-white">Hextrot</strong> (dba Phase Flag)</p>
              <p>
                Email:{' '}
                <a href="mailto:legal@phaseflag.com" className="text-[#6366F1] hover:text-white transition-colors">
                  legal@phaseflag.com
                </a>
              </p>
            </div>
          </Section>
        </div>
      </div>

      <style>{`
        .prose-legal h2 {
          color: #ffffff;
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 2.5rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
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
          space-y: 0.25rem;
        }
        .prose-legal li {
          margin-bottom: 0.25rem;
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
