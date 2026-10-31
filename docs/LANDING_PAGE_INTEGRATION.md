# Landing-page integration contract

Reserved routes:

| Route                   | Owner / purpose                                               |
| ----------------------- | ------------------------------------------------------------- |
| `/`                     | Future landing page, replacing the current redirect           |
| `/auth/login`           | Application sign-in                                           |
| `/auth/signup`          | Customer registration                                         |
| `/auth/setup`           | First administrator setup, unavailable once an account exists |
| `/auth/forgot-password` | SMTP-backed password recovery                                 |
| `/app`                  | Protected operations overview / customer portal               |
| `/app/*`                | Application pages                                             |
| `/privacy`              | Privacy Policy                                                |
| `/terms`                | Terms and Conditions                                          |

The landing page can be supplied as a React component and assets. Keep styles scoped to its wrapper or a CSS module to avoid changing application tables, buttons or headings. Do not wrap `/app` in the landing-page navigation or footer. Keep the root layout responsible only for shared document metadata and global tokens.

If landing and application are hosted on separate domains, use absolute links to the application origin. Authentication stays on the application origin; do not pass session tokens in query strings. Configure APP_URL to the actual application origin before sending account links.

The landing page must follow the same content rules: no fabricated metrics, testimonials, logos, reviews or unverified claims. Screenshots should reflect the actual application.
