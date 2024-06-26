import type { V2_MetaFunction } from '@remix-run/node'
import type { ReactElement } from 'react'

import { Page } from '~/components/page'

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: 'Cookies'
    },
    {
      property: 'og:title',
      content: 'Cookies'
    },
    {
      name: 'description',
      content: 'Write me'
    },
    {
      name: 'og:url',
      content: 'https://steam-revenue-calculator.com/cookies'
    }
  ]
}

export default function CookiesRoute(): ReactElement {
  return (
    <Page>
      <div className="space-y-8 max-w-2xl leading-loose">
        <h1 className="text-3xl md:text-4xl font-poppins font-bold">Cookies</h1>
        <div className="space-y-8">
          <p>Last updated: June 26, 2024</p>

          <section className="space-y-2">
            <h2 className="text-xl md:text-2xl font-poppins font-bold">
              What Are Cookies?
            </h2>
            <p>
              Cookies are small text files that are placed on your device to
              help the site provide a better user experience. In general,
              cookies are used to retain user preferences, store information for
              things like shopping carts, and provide anonymized tracking data
              to third party applications like Google Analytics.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl md:text-2xl font-poppins font-bold">
              How We Use Cookies
            </h2>
            <p>We use cookies for several purposes, detailed below:</p>
            <ul className="list-disc pl-4 space-y-2">
              <li>To enable certain functions of the service;</li>
              <li>To provide analytics;</li>
              <li>To store your preferences;</li>
              <li>
                To enable advertisements delivery, including behavioral
                advertising.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl md:text-2xl font-poppins font-bold">
              Disabling Cookies
            </h2>
            <p>
              You can prevent the setting of cookies by adjusting the settings
              on your browser (see your browser Help for how to do this). Be
              aware that disabling cookies will affect the functionality of this
              and many other websites that you visit. Disabling cookies will
              usually result in also disabling certain functionality and
              features of this site. Therefore, it is recommended that you do
              not disable cookies.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl md:text-2xl font-poppins font-bold">
              The Cookies We Set
            </h2>
            <ul className="list-disc pl-4 space-y-2">
              <li>
                Account related cookies: If you create an account with us, we
                will use cookies for the management of the signup process and
                general administration. These cookies will usually be deleted
                when you log out, however in some cases they may remain
                afterwards to remember your site preferences when logged out.
              </li>
              <li>
                Login related cookies: We use cookies when you are logged in so
                that we can remember this fact. This prevents you from having to
                log in every single time you visit a new page. These cookies are
                typically removed or cleared when you log out to ensure that you
                can only access restricted features and areas when logged in.
              </li>
              <li>
                Email newsletters related cookies: This site offers newsletter
                or email subscription services and cookies may be used to
                remember if you are already registered and whether to show
                certain notifications which might only be valid to
                subscribed/unsubscribed users.
              </li>
              <li>
                Orders processing related cookies: This site offers e-commerce
                or payment facilities and some cookies are essential to ensure
                that your order is remembered between pages so that we can
                process it properly.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl md:text-2xl font-poppins font-bold">
              Third Party Cookies
            </h2>
            <p>
              In some special cases, we also use cookies provided by trusted
              third parties. The following section details which third party
              cookies you might encounter through this site:
            </p>
            <ul className="list-disc pl-4 space-y-2">
              <li>
                Google Analytics: Google Analytics is one of the most spread and
                trusted analytics solutions on the web for helping us to
                understand how you use the site and ways that we can improve
                your experience. These cookies may track things such as how long
                you spend on the site and the pages that you visit so we can
                continue to produce engaging content.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl md:text-2xl font-poppins font-bold">
              More Information
            </h2>
            <p>
              Hopefully, that has clarified things for you and as was previously
              mentioned if there is something that you aren't sure whether you
              need or not it's usually safer to leave cookies enabled in case it
              does interact with one of the features you use on our site.
              However, if you are still looking for more information, you can
              contact us through one of our preferred contact methods:
            </p>
            <p>Email: contact@steam-revenue-calculator.com</p>
          </section>
        </div>
      </div>
    </Page>
  )
}
