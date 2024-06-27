import type { V2_MetaFunction } from '@remix-run/node'
import type { ReactElement } from 'react'

import { Page } from '~/components/page'

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: 'Privacy'
    },
    {
      property: 'og:title',
      content: 'Privacy'
    },
    {
      name: 'description',
      content: `Read Steam Revenue Calculator's privacy policy to learn how we protect your personal information. Find out about our data collection practices, user rights, and commitment to safeguarding your privacy.`
    },
    {
      name: 'og:url',
      content: 'https://steam-revenue-calculator.com/privacy'
    }
  ]
}

export default function PrivacyRoute(): ReactElement {
  return (
    <Page>
      <div className="space-y-8">
        <h1 className="text-3xl md:text-4xl font-poppins font-bold">
          Privacy Policy
        </h1>
        <div className="space-y-4">
          <p>Last updated: June 26, 2024</p>
          <p>
            This Privacy Policy outlines how PMKIN (referred to as "we", "us",
            or "our") collects, uses, and discloses your information when you
            use our service. By using the service, you consent to the data
            practices described in this policy.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Collection of Personal Data
          </h2>
          <p>
            We may collect personal data such as your email address and any
            other information you provide. This includes data automatically
            collected when you use our service, like your IP address and browser
            details.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Use of Personal Data
          </h2>
          <p>
            Your data is used to provide and enhance our service, manage your
            account, and communicate with you. This may include sharing your
            data with third parties that assist us in offering the service.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Cookies and Tracking
          </h2>
          <p>
            We use cookies to track website activity and user preferences. You
            have the option to refuse cookies, which may limit your use of our
            service.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Data Sharing
          </h2>
          <p>
            We may share your data with affiliates, for business transactions,
            and to comply with legal obligations. Your personal data may also be
            visible to other users if you interact in public areas.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Data Retention
          </h2>
          <p>
            We retain your personal data as long as necessary to fulfill the
            purposes outlined in this policy, unless a longer retention period
            is required or permitted by law.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Data Transfer
          </h2>
          <p>
            Your data may be transferred and processed in countries other than
            your own. We ensure the security of your data in these transfers.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Your Rights
          </h2>
          <p>
            You have the right to access, update, or delete your personal data.
            Contact us to exercise these rights.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Security
          </h2>
          <p>
            We strive to protect your personal data but cannot guarantee its
            absolute security.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Children's Privacy
          </h2>
          <p>
            Our service is not intended for children under 13. We do not
            knowingly collect data from this age group.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Third-Party Links
          </h2>
          <p>
            Our service may contain links to other sites. We are not responsible
            for their privacy practices.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Changes to This Policy
          </h2>
          <p>
            We may update our Privacy Policy and will notify you of these
            changes. You're encouraged to review this policy periodically.
          </p>

          <h2 className="text-xl md:text-2xl font-poppins font-bold">
            Contact Us
          </h2>
          <p>
            If you have questions about this privacy policy, contact us at
            contact@steam-revenue-calculator.com.
          </p>
        </div>
      </div>
    </Page>
  )
}
