# Email setup for the KYC form (Microsoft 365)

- **Status:** research findings and admin checklist. Nothing in this document has been applied yet.
- **Date:** 2026-10-05
- **Covers these review-meeting action items:** "Configure Microsoft Email" and "Research Email System"
- **Audience:** the developer, and the company admin who holds Microsoft 365 Global Admin access

Items marked **[UNVERIFIED]** could not be confirmed from public sources or from outside the tenant. Someone with admin access must check them.

---

## 1. Summary

1. The domain is already on Microsoft 365 and most of the DNS is correct. MX points to Exchange Online, SPF allows Microsoft 365 only, and both DKIM CNAMEs and a DMARC record exist. The zone was last edited today (SOA serial `2026100502`), so some public resolvers do not show the newest records yet.
2. Mail sent by the KYC app today will probably fail authentication. The app uses PHP `mail()` on the Bluehost server, but the SPF record ends in `-all` and lists only Microsoft 365. Bluehost's server is not an allowed sender, so SPF fails, and nothing on the Bluehost side signs with a woodhallfinanceltd.com DKIM key. Recipients will probably junk or reject these messages, including Microsoft 365 mailboxes such as `credit@`.
3. Username/password SMTP to `smtp.office365.com` still works today, but only for about three more months. At the end of December 2026 Microsoft turns it off by default. It is not a sound base for new work.
4. **Recommendation:** send through the **Microsoft Graph API** (`sendMail`), using an app-only Entra app registration whose access is scoped to one mailbox (`no-reply@woodhallfinanceltd.com`). This needs only plain PHP and curl over HTTPS port 443, with no Composer. Section 4 gives the reasons.
5. `config.php` still points at the **woodhallcap.com** domain (`analyst@woodhallcap.com`, `no-reply@woodhallcap.com`, "Woodhall Capital"). The target is `credit@woodhallfinanceltd.com`, so these values must change too (section 7).

---

## 2. What exists today

### 2.1 Current app mail setup (from the repo)

`config.php`:

```php
define('RECIPIENT_EMAIL', 'analyst@woodhallcap.com');
define('RECIPIENT_NAME', 'Woodhall Capital');
define('SMTP_HOST', '');            // empty, so PHPMailer falls back to PHP mail()
define('SMTP_PORT', 587);
define('SMTP_USERNAME', '');
define('SMTP_PASSWORD', '');
define('SMTP_SECURE', 'tls');
define('MAIL_FROM_ADDRESS', 'no-reply@woodhallcap.com');
define('MAIL_FROM_NAME', 'Woodhall Capital');
define('MAX_FILE_SIZE_BYTES', 5 * 1024 * 1024);    // 5 MB per upload
define('MAX_TOTAL_SIZE_BYTES', 20 * 1024 * 1024);  // 20 MB total
```

`lib/mailer.php` sends two messages per submission with vendored PHPMailer 6.9.3 (`vendor/phpmailer/`: `PHPMailer.php`, `SMTP.php`, `Exception.php` only):

- **(a) Notification** to `RECIPIENT_EMAIL`. It carries the generated PDF, every uploaded document and an embedded logo (`cid:woodhall-logo`). With 20 MB of uploads, the message can reach about 20 MB of raw data, or about 27 MB once base64-encoded.
- **(b) Confirmation** to the submitter's own email address, with the PDF and the logo.

There is no `config.local.php` loading in `config.php`, although `.gitignore` lists `config.local.php`. Any secrets added to `config.php` would therefore be committed. Fix this before adding credentials (section 7).

### 2.2 DNS findings for woodhallfinanceltd.com (queried 2026-10-05)

I queried the public resolvers 1.1.1.1 and 8.8.8.8 and the authoritative servers `ns1/ns2.bluehost.com`.

| Record | Current value | Assessment |
|---|---|---|
| NS | `ns1.bluehost.com`, `ns2.bluehost.com` | **DNS is hosted at Bluehost.** Edit it in the Bluehost portal (Domains, then DNS) or in cPanel Zone Editor. |
| SOA | `ns1.bluehost.com. root.box5735.bluehost.com. 2026100502 …` | Serial is today's date, revision 02. Someone edited the zone today. |
| MX | `0 woodhallfinanceltd-com.mail.protection.outlook.com.` | Correct for Microsoft 365. |
| TXT (apex) | `MS=ms36916370` | Microsoft 365 domain-verification record. Keep it. |
| TXT (apex) | `v=spf1 include:spf.protection.outlook.com -all` | Correct for "Microsoft 365 is the only sender". **It does not authorize Bluehost.** |
| TXT (apex) | `google-site-verification=I03snw…` | Google Search Console. Unrelated to mail. |
| TXT `_dmarc` | `v=DMARC1; p=none;` | Present on the authoritative servers, but it has **no `rua=` reporting address**. 8.8.8.8 did not return it yet because it was just added. |
| CNAME `selector1._domainkey` | `selector1-woodhallfinanceltd-com._domainkey.woodhallcapital647.r-v1.dkim.mail.microsoft.` | Correct (Microsoft's new DKIM CNAME format). 8.8.8.8 did not return it yet. The target resolves to a valid DKIM key. |
| CNAME `selector2._domainkey` | `selector2-woodhallfinanceltd-com._domainkey.woodhallcapital647.r-v1.dkim.mail.microsoft.` | Correct. |
| autodiscover | **A** `162.241.252.194` (Bluehost cPanel server) | **Wrong for Microsoft 365.** It should be a CNAME to `autodiscover.outlook.com`. |
| SRV `_autodiscover._tcp` | `0 0 443 cpanelemaildiscovery.cpanel.net.` | **cPanel default. Remove it.** Outlook may follow it to cPanel instead of Microsoft 365. |
| A (apex), `www` | `66.235.200.146` | Main website. Unrelated to mail. |
| A `kyc`, `mail`, `cpanel`, `webmail`, `autoconfig` | `162.241.252.194` (PTR `box5735.bluehost.com`) | `kyc` is the KYC app's server. This is also the IP that PHP `mail()` would send from **[UNVERIFIED: Bluehost may route outbound mail through a different relay. Check the `Received:` headers of a test message.]** |
| `default._domainkey` | none | No Bluehost/cPanel DKIM key is published for this domain. |
| `enterpriseregistration`, `enterpriseenrollment`, `lyncdiscover`, `_sip._tls` | none | Only needed for Intune/Teams. Not needed for this project. |

Inferred: the DKIM CNAME target `woodhallcapital647` suggests the tenant's initial domain is `woodhallcapital647.onmicrosoft.com`. **[UNVERIFIED]** Confirm under Settings > Domains in the admin center.

**For comparison, woodhallcap.com (the domain `config.php` uses today)** is also on Bluehost DNS. It has MX to Microsoft 365, SPF `include:spf.protection.outlook.com -all`, and a DMARC record that reports to Brevo. It has **no** Microsoft `selector1/selector2` DKIM CNAMEs, only a cPanel `default._domainkey` key. Its apex A record includes the same Bluehost server `162.241.252.194`. Whether woodhallcap.com is in the same Microsoft 365 tenant is **[UNVERIFIED]**.

---

## 3. Microsoft's retirement of Basic auth for SMTP AUTH (as of October 2026)

**What happened:**

- **26 April 2024:** Microsoft announced the retirement of Basic auth for SMTP AUTH client submission ([Message Center MC786329](https://mc.merill.net/message/MC786329); [original Exchange Team blog post](https://techcommunity.microsoft.com/blog/exchange/exchange-online-to-retire-basic-auth-for-client-submission-smtp-auth/4114750)). The plan then became a rejection rollout from **1 March 2026** to **30 April 2026** ([Office 365 for IT Pros](https://office365itpros.com/2026/01/29/smtp-auth-basic-retirement/)).
- **27–28 January 2026:** Microsoft postponed that plan ([Exchange Team blog, "Updated Exchange Online SMTP AUTH Basic Authentication Deprecation Timeline"](https://techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835); [Japanese mirror of the post](https://jpmessaging.github.io/blog/Updated-Exchange-Online-SMTP-AUTH-Basic-Authentication-Deprecation-Timeline/)).

**The current timeline:**

| When | What happens |
|---|---|
| Now to December 2026 | No change. Basic auth SMTP AUTH keeps working where it is enabled. |
| **End of December 2026** | Basic auth SMTP AUTH is **disabled by default for existing tenants**. Admins can still turn it back on. |
| New tenants created after December 2026 | Basic auth SMTP AUTH is unavailable. Only OAuth is supported. |
| **Second half of 2027** | Microsoft will announce the **final removal date**. |

**What this means for us:**

- Username and password still work against `smtp.office365.com:587` today, if SMTP AUTH is enabled for the mailbox and the tenant does not use Security Defaults.
- From about 1 January 2027 it stops working unless an admin turns it back on. After a date to be announced in 2027, it stops for good.
- **OAuth is the only long-term supported way to use SMTP AUTH.**

Two more blockers apply today, whatever the date:

- If **Security Defaults** is on in Entra ID, SMTP AUTH is already disabled. Microsoft says Basic-auth client submission "isn't compatible with Security defaults" ([Enable or disable SMTP AUTH](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission); [MFD/application guide](https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365)). Whether this tenant uses Security Defaults is **[UNVERIFIED]**.
- SMTP AUTH is **off by default for organizations created after January 2020**. It must be enabled per mailbox with `Set-CASMailbox -SmtpClientAuthenticationDisabled $false` (same sources).

**[UNVERIFIED]:** I found no newer Microsoft announcement after January 2026 that changes these dates. The sources dated up to September 2026 still describe this timeline. Check the Message Center in the admin center before you rely on it.

---

## 4. Options for sending from PHP on Bluehost

### Option 1: `smtp.office365.com` with SMTP AUTH

**1a. Basic auth (username and password)**

- **Pros:** No code changes. Set `SMTP_HOST=smtp.office365.com`, port 587, `tls`, and the mailbox credentials in `config.php`.
- **Cons:**
  - Disabled by default from the end of December 2026, as described in section 3.
  - Blocked if Security Defaults is on.
  - Needs a **licensed** user mailbox with a password. A shared mailbox has no usable password. Microsoft says to keep sign-in blocked for shared mailboxes ([About shared mailboxes](https://learn.microsoft.com/en-us/microsoft-365/admin/email/about-shared-mailboxes)).
  - Needs SMTP AUTH enabled on that mailbox. A long-lived password sits on shared hosting. The mailbox is probably subject to MFA or Conditional Access as well.
  - Limits: 10,000 recipients per day and 30 messages per minute ([MFD/application guide](https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365)).
- **Verdict:** Acceptable only as a stop-gap until December 2026.

**1b. OAuth2 (XOAUTH2)**

- **How it works:** Microsoft supports the client-credentials (app-only) flow for SMTP:
  1. Register an app in Entra.
  2. Add the **Office 365 Exchange Online > `SMTP.SendAsApp`** application permission and grant admin consent.
  3. Register the service principal in Exchange with `New-ServicePrincipal`.
  4. Grant it `Add-MailboxPermission … -AccessRights FullAccess` on the sending mailbox.
  5. Request tokens with scope `https://outlook.office365.com/.default` ([Authenticate an IMAP, POP or SMTP connection using OAuth](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth)).
- **PHPMailer's own OAuth helper** (`PHPMailer\PHPMailer\OAuth`) needs Composer packages: **`league/oauth2-client`** plus an Azure provider such as **`greew/oauth2-azure-provider`** (or `thenetworg/oauth2-azure`). PHPMailer's guide also uses the *delegated* authorization-code flow: you run `get_oauth_token.php` once to obtain a refresh token ([PHPMailer wiki: Microsoft Azure and XOAUTH2 setup guide](https://github.com/PHPMailer/PHPMailer/wiki/Microsoft-Azure-and-XOAUTH2-setup-guide)).
- **A Composer-free path exists.** PHPMailer accepts any object that implements its `OAuthTokenProvider` interface (`PHPMailer::setOAuth()`, used by `SMTP.php` for `AUTH XOAUTH2`). You could vendor the small `OAuthTokenProvider.php` interface file and write a roughly 40-line class that gets a client-credentials token with curl. Our vendored copy does **not** include `OAuthTokenProvider.php` or `OAuth.php` today.
- **Cons:**
  - Still needs SMTP AUTH enabled on the mailbox, which Microsoft recommends keeping off.
  - Still needs outbound **port 587** from Bluehost shared hosting. Bluehost basic shared plans are reported to block outbound SMTP to external servers ([WP Mail SMTP: hosts that block SMTP](https://wpmailsmtp.com/why-your-web-host-blocked-smtp/)). **[UNVERIFIED for this account: test it as shown in section 6.1.]**
  - Most of the setup work is the same as Option 2.
- **Verdict:** Workable, but it has every requirement of Option 2 plus the port-587 risk.

### Option 2: Microsoft Graph `sendMail`, app-only (client credentials) — **recommended**

**How it works:**

1. **Get a token.** `POST https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token` with `grant_type=client_credentials`, `client_id`, `client_secret` (or a certificate) and `scope=https://graph.microsoft.com/.default` ([client credentials flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)). The token lasts about an hour, so a fresh token per submission is fine.
2. **Send.** `POST https://graph.microsoft.com/v1.0/users/no-reply@woodhallfinanceltd.com/sendMail` with `Authorization: Bearer …`. A success returns `202 Accepted`. The request body can be JSON (`message` + `attachments[]` of `#microsoft.graph.fileAttachment` with base64 `contentBytes`) or a base64-encoded **MIME** message sent as `Content-Type: text/plain` ([user: sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)). The message is saved to Sent Items unless `saveToSentItems` is false.
3. **No Composer needed.** Both calls are plain `curl_*` with `json_encode`.
4. **PHPMailer can still build the message.** PHPMailer could keep composing the message (HTML body, embedded `cid:` logo, attachments): call `$mail->preSend()`, then `$mail->getSentMIMEMessage()`, base64-encode the result and POST it as MIME. Only the transport changes.

**Size limits** (important, because uploads can total 20 MB):

- Graph requests are limited to about **4 MB**. Larger requests get HTTP 413, and this applies to MIME payloads too ([Microsoft Q&A: sendMail request size limit](https://learn.microsoft.com/en-us/answers/questions/1824204/graph-api-user-sendmail-request-size-limit)). The confirmation email (PDF + logo) will usually fit in one `sendMail` call. The notification email often will not.
- **For large messages:**
  1. Create a draft with `POST /users/{mailbox}/messages`.
  2. Add files under 3 MB with `POST …/attachments`.
  3. Add files from 3 MB to 150 MB with `POST …/attachments/createUploadSession`, then chunked `PUT`s of 4 MB or less to the pre-authenticated `uploadUrl`. Do **not** send an `Authorization` header on those `PUT`s.
  4. Send the draft with `POST /users/{mailbox}/messages/{id}/send`.

  Upload sessions need **`Mail.ReadWrite`** in addition to `Mail.Send` ([Attach large files to Outlook messages](https://learn.microsoft.com/en-us/graph/outlook-large-attachments)). Microsoft lists a known issue with large attachments in shared or delegated mailboxes, so test this path against the chosen mailbox type.
- **Exchange's per-message size cap still applies.** The default `MaxSendSize` is 35 MB **[UNVERIFIED for this tenant: check with `Get-Mailbox no-reply@… | fl MaxSendSize`]**. 20 MB of uploads is about 27 MB after encoding, which fits under 35 MB.

**Entra app registration** (Entra admin center > App registrations > New registration):

- Single tenant ("Accounts in this organizational directory only"). No redirect URI is needed ([Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)).
- Create a **client secret** (Certificates & secrets). Record its expiry date, because a secret expires and sending stops silently when it does. A certificate credential is stronger, but it means managing a private key on Bluehost.

**Scope the app to one mailbox** (do not leave it able to send as anyone):

- **RBAC for Applications in Exchange Online.** Microsoft states that it **replaces Application Access Policies**, and the old Graph page on limiting mailbox access now redirects to the RBAC page ([RBAC for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)). You grant the scoped Exchange roles **`Application Mail.Send`** and, for upload sessions, **`Application Mail.ReadWrite`**, limited to a management scope that contains only `no-reply@`.
- **Do not also grant `Mail.Send` as an application permission in Entra API permissions.** Entra grants and Exchange RBAC grants are combined as a union, so an unscoped Entra `Mail.Send` would let the app send as **any** mailbox, whatever the scope says ([same page, FAQ](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac); [Office 365 for IT Pros: control Mail.Send with RBAC for Applications](https://office365itpros.com/2026/02/17/mail-send-rbac-for-applications/)).
- Permission changes take **30 minutes to 2 hours** to apply. `Test-ServicePrincipalAuthorization` shows the result immediately.
- **Legacy alternative:** grant Entra `Mail.Send` (application) with admin consent, then restrict it with `New-ApplicationAccessPolicy -AccessRight RestrictAccess -PolicyScopeGroupId <mail-enabled security group>`. Microsoft now positions this as superseded, so use RBAC for Applications.

**Pros:**

- Uses HTTPS port 443, which shared hosting does not block.
- Not affected by the SMTP AUTH retirement, Security Defaults or the per-mailbox SMTP AUTH switch.
- Works with an **unlicensed shared mailbox**: no password, sign-in stays blocked.
- Mail leaves from Exchange Online, so the **existing** SPF and DKIM records align and DMARC passes, with no DNS changes for Bluehost.
- A copy lands in the mailbox's Sent Items, which is useful as an audit trail for KYC.

**Cons:**

- More code than flipping SMTP settings: a token call plus a draft and upload-session path for large notifications.
- The client secret must be rotated before it expires.
- Exchange Online sending limits still apply.

### Option 3: Bluehost `mail()` or Bluehost SMTP, sending as `@woodhallfinanceltd.com`

This is what happens today, because `SMTP_HOST` is empty.

**To make it pass authentication you would need all of these:**

- **SPF:** add Bluehost to the single SPF record. Microsoft says to keep exactly one SPF record and to merge values rather than add a second record ([Set up SPF](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure); [Connect your domain by adding DNS records](https://learn.microsoft.com/en-us/microsoft-365/admin/get-help-with-domains/create-dns-records-at-any-dns-hosting-provider)).
  - Bluehost documents `include:bluehost.com` ([Bluehost DNS records for email](https://www.bluehost.com/help/article/bh-email-dns-email-services)). **However,** today's `bluehost.com` SPF record nests about a dozen includes (Qualtrics, Salesforce, SparkPost, Mailjet, cloudfilter, websitewelcome, and more). Together with `include:spf.protection.outlook.com`, I count roughly 15 DNS lookups, which is over SPF's limit of 10 and gives a `permerror` at receivers that evaluate the full record. It would also authorize many unrelated senders.
  - A tighter option is `v=spf1 include:spf.protection.outlook.com ip4:<Bluehost outbound IP> -all`. The outbound IP is probably `162.241.252.194`, but this is **[UNVERIFIED]**. I could not find `162.241.252.194` in Bluehost's published ranges, so read the real IP from a test message's headers.
- **DKIM:** enable DKIM for woodhallfinanceltd.com in cPanel > Email > Email Deliverability. Publish the `default._domainkey` TXT key it generates **alongside** the Microsoft `selector1/selector2` CNAMEs (different selectors do not conflict).
- **DMARC:** with SPF on the envelope sender and DKIM `d=woodhallfinanceltd.com`, DMARC aligns.
- **Local-delivery trap [UNVERIFIED, but common on cPanel]:** if the cPanel account considers woodhallfinanceltd.com (or woodhallcap.com) a *local* mail domain, mail that PHP sends to `credit@woodhallfinanceltd.com` is delivered to a cPanel mailbox on the Bluehost server and **never reaches Microsoft 365**. In cPanel > Email > Email Routing, both domains must be set to **Remote Mail Exchanger**. Check this even if you pick Option 2, since it affects any test sent with `mail()`.

**Cons:**

- Shared IP reputation (other customers' spam affects you).
- Bluehost hourly sending caps **[UNVERIFIED]**.
- A second sending infrastructure to keep authenticated.
- No Sent Items copy.

**Verdict:** Not recommended.

### Option 4: Microsoft 365 connector, relay, Direct Send or High Volume Email

- **SMTP relay through an inbound connector** needs a TLS certificate or a **static IP not shared with another organization**. Microsoft states plainly: "You can't use SMTP relay to send email from a third-party hosted service." Bluehost shared hosting fails both requirements ([MFD/application guide](https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365)). **Not viable.**
- **Direct Send** (port 25 to the MX) delivers only to recipients inside the tenant, and submitters are external. Microsoft is also moving to disable it by default. **Not viable** for the confirmation email.
- **High Volume Email (HVE)** sends to internal recipients only. **Not viable** for the confirmation email.
- **Azure Communication Services Email** is Microsoft's suggested replacement for external app mail. It needs an Azure subscription, pay-per-message billing and its own domain verification. It is overkill at KYC-form volumes, but it is a fallback if Graph is ruled out.

### 4.1 Recommendation

**Use Option 2 (Graph `sendMail`, app-only, scoped with RBAC for Applications to a shared mailbox `no-reply@woodhallfinanceltd.com`).**

- **Not affected by the retirement.** It does not depend on SMTP AUTH, so neither the December 2026 default-off date nor the 2027 removal affects it. Security Defaults does not block it.
- **Uses HTTPS 443**, which avoids the uncertain outbound-SMTP policy on Bluehost shared hosting.
- **Authenticates with no DNS work.** Mail leaves from Exchange Online, so it passes the SPF, DKIM and DMARC already published for woodhallfinanceltd.com. We do not need to weaken SPF or manage a second DKIM key at Bluehost.
- **No Composer**, which matches the deploy constraint.
- **Least privilege.** Scoped RBAC limits the app to one unlicensed mailbox, and Sent Items keeps a record of every KYC email sent.

**Main cost:** about a day of PHP work to add a Graph transport, including the draft and upload-session path for notifications over about 3–4 MB.

**Stop-gap until the Graph code ships:** Option 1a (Basic SMTP AUTH from a licensed mailbox), if outbound port 587 works from Bluehost and Security Defaults is off. Treat it as temporary because of the December 2026 date.

---

## 5. Admin checklist

The **[A]** steps need the Global Admin (or Exchange Admin plus Application Admin). The **[D]** steps are for the developer.

### 5.1 Access

1. **[A]** Sign in at <https://admin.microsoft.com> (Microsoft 365 admin center) with the Global Admin account. Confirm that MFA works for that account.
2. **[A]** Give the developer access in one of two ways. Either:
   - assign the developer's own account **Exchange Administrator** and **Application Administrator** (Users > Active users > user > Manage roles), or
   - do the steps below together on a screen share.

   Do not share the Global Admin password.
3. **[A]** Under Settings > Domains, check that **woodhallfinanceltd.com** shows **Healthy**. Note the initial `*.onmicrosoft.com` domain (expected: `woodhallcapital647.onmicrosoft.com`). Check whether **woodhallcap.com** is in the same tenant.
4. **[A]** Check whether Security Defaults is on: Entra admin center <https://entra.microsoft.com> > Identity > Overview > Properties > Manage security defaults. This only matters for Option 1.

### 5.2 Sending mailbox

5. **[A]** Create a **shared mailbox** `no-reply@woodhallfinanceltd.com`, display name "Woodhall Finance" (admin center > Teams & groups > Shared mailboxes > Add).
   - Shared mailboxes need **no license** up to 50 GB. Keep **sign-in blocked** ([About shared mailboxes](https://learn.microsoft.com/en-us/microsoft-365/admin/email/about-shared-mailboxes)).
   - Microsoft notes that send permissions can take about an hour to replicate after creation.
   - *If you choose the Option 1a stop-gap instead:* you need a **licensed user** mailbox (for example Exchange Online Plan 1) with a strong password, SMTP AUTH enabled, and an exclusion from MFA or Conditional Access for SMTP. This is one more reason to prefer Option 2.
6. **[A]** Confirm that `credit@woodhallfinanceltd.com` exists (user mailbox, shared mailbox or group). With Graph, the notification is sent from inside the tenant. If `credit@` is a group and the stop-gap or Bluehost route is used even briefly, turn on "Allow external senders" for it.

### 5.3 Entra app and permissions (Option 2)

7. **[A]** Entra admin center > App registrations > New registration:
   - Name: `kyc-mailer`
   - Supported account types: single tenant
   - Redirect URI: none

   Record the **Application (client) ID** and the **Directory (tenant) ID**.
8. **[A]** Under Certificates & secrets, create a **New client secret** with a 12- or 24-month expiry. Give the value to the developer over a secure channel. **Put a calendar reminder two weeks before it expires.**
9. **[A]** Under API permissions, **do not** add Microsoft Graph `Mail.Send` (application). Scoping is done in Exchange in the next step.
10. **[A]** Run these in Exchange Online PowerShell (`Install-Module ExchangeOnlineManagement`, then `Connect-ExchangeOnline`). Use the **Enterprise applications** IDs, not the App registrations page, because the object IDs differ.

    ```powershell
    # 1. Point Exchange at the Entra service principal
    New-ServicePrincipal -AppId <APP_ID> -ObjectId <ENTERPRISE_APP_OBJECT_ID> -DisplayName "kyc-mailer"

    # 2. A scope containing only the sending mailbox
    New-ManagementScope -Name "kyc-mailer-scope" `
      -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'no-reply@woodhallfinanceltd.com'"

    # 3. Scoped roles (Mail.ReadWrite is only for large-attachment upload sessions)
    New-ManagementRoleAssignment -App <APP_ID> -Role "Application Mail.Send"      -CustomResourceScope "kyc-mailer-scope"
    New-ManagementRoleAssignment -App <APP_ID> -Role "Application Mail.ReadWrite" -CustomResourceScope "kyc-mailer-scope"

    # 4. Verify: InScope should be True for no-reply@ and False for any other mailbox
    Test-ServicePrincipalAuthorization -Identity <APP_ID> -Resource no-reply@woodhallfinanceltd.com
    Test-ServicePrincipalAuthorization -Identity <APP_ID> -Resource credit@woodhallfinanceltd.com
    ```

    Allow 30 minutes to 2 hours before the live API calls succeed ([RBAC for Applications](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)).

### 5.4 DNS at Bluehost (woodhallfinanceltd.com)

Edit the records in the Bluehost portal (Domains > woodhallfinanceltd.com > DNS) or in cPanel > Zone Editor. Before changing anything, take a screenshot or export of the zone.

| # | Record | Action | Value |
|---|---|---|---|
| 11 | MX `@` | **Keep** | `0 woodhallfinanceltd-com.mail.protection.outlook.com` |
| 12 | TXT `@` (SPF) | **Keep as is** for Option 2 | `v=spf1 include:spf.protection.outlook.com -all` |
|  |  | *Only if Bluehost also sends (Option 3):* replace the record, keeping a single SPF record | `v=spf1 include:spf.protection.outlook.com ip4:<verified Bluehost outbound IP> -all`. Avoid `include:bluehost.com` because of the lookup limit (section 4, Option 3). |
| 13 | CNAME `selector1._domainkey` | **Keep** | `selector1-woodhallfinanceltd-com._domainkey.woodhallcapital647.r-v1.dkim.mail.microsoft` |
| 14 | CNAME `selector2._domainkey` | **Keep** | `selector2-woodhallfinanceltd-com._domainkey.woodhallcapital647.r-v1.dkim.mail.microsoft` |
| 15 | TXT `_dmarc` | **Edit** to add reporting | `v=DMARC1; p=none; rua=mailto:dmarc-reports@woodhallfinanceltd.com; pct=100` |
| 16 | A `autodiscover` | **Delete** | (was `162.241.252.194`) |
| 17 | CNAME `autodiscover` | **Add** | `autodiscover.outlook.com` (TTL 3600) |
| 18 | SRV `_autodiscover._tcp` | **Delete** | (was `cpanelemaildiscovery.cpanel.net`) |

Notes on the DNS changes:

- **DMARC reports (row 15):** create `dmarc-reports@` as a shared mailbox or a Microsoft 365 group first. Microsoft recommends a dedicated mailbox rather than a person's inbox ([Set up DMARC](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure)). Stay at `p=none` for 2–4 weeks and read the reports. Then move to `p=quarantine` (optionally stepping `pct=` up), and later to `p=reject`.
- **Autodiscover (rows 16–18):** Microsoft lists the autodiscover CNAME as "optional but highly recommended" ([Connect your domain by adding DNS records](https://learn.microsoft.com/en-us/microsoft-365/admin/get-help-with-domains/create-dns-records-at-any-dns-hosting-provider)). The admin center's Domains > DNS records page shows the exact value for this tenant, so use that. **[UNVERIFIED]** cPanel may re-create its autodiscover records if cPanel's email service stays enabled for the domain. Check again a day later.
- **TTL:** use 3600 for all records. Exchange Online supports MX TTLs below 6 hours.

19. **[A]** **Enable DKIM signing.** In the Defender portal go to <https://security.microsoft.com/authentication?viewid=DKIM> (Email & collaboration > Policies & rules > Threat policies > Email authentication settings > DKIM). Select woodhallfinanceltd.com and turn on **Sign messages for this domain with DKIM signatures**. Alternatively, run `Set-DkimSigningConfig -Identity woodhallfinanceltd.com -Enabled $true`. Check with `Get-DkimSigningConfig | fl Domain,Enabled,Selector1CNAME,Selector2CNAME` ([DKIM for custom domains](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure)). The CNAMEs are already published, so the toggle should succeed. Whether it is already on is **[UNVERIFIED]**.
20. **[A]** In cPanel > Email > **Email Routing**, set woodhallfinanceltd.com (and woodhallcap.com) to **Remote Mail Exchanger**, so the Bluehost server never delivers these domains locally.
21. **[A] Optional:** apply the same DKIM and DMARC work to **woodhallcap.com** if it stays in use.

### 5.5 Developer work (after the admin steps)

22. **[D]** Add a Graph transport to `lib/mailer.php`:
    1. Get a token.
    2. If the MIME message is under about 3.5 MB, POST it to `sendMail`.
    3. Otherwise, use draft + attachments + upload session + `/send`.

    Keep PHPMailer for composing the message, so the `cid:` logo keeps working. Log Graph error bodies, but never log the token or the secret.
23. **[D]** Update `config.php` as described in section 7 and load secrets from the git-ignored `config.local.php`.

---

## 6. Testing

### 6.1 Before choosing SMTP (Option 1 only): is port 587 open from Bluehost?

Over SSH on the Bluehost account:

```sh
php -r '$s=@fsockopen("smtp.office365.com",587,$e,$m,10); echo $s ? "587 open\n" : "blocked: $m\n";'
php -r '$s=@fsockopen("graph.microsoft.com",443,$e,$m,10); echo $s ? "443 open\n" : "blocked: $m\n";'
```

### 6.2 DNS checks after the changes

```sh
dig +short TXT woodhallfinanceltd.com
dig +short TXT _dmarc.woodhallfinanceltd.com
dig +short CNAME selector1._domainkey.woodhallfinanceltd.com
dig +short CNAME selector2._domainkey.woodhallfinanceltd.com
dig +short CNAME autodiscover.woodhallfinanceltd.com      # expect autodiscover.outlook.com.
dig +short SRV _autodiscover._tcp.woodhallfinanceltd.com  # expect nothing
dig @8.8.8.8 +short TXT _dmarc.woodhallfinanceltd.com     # public resolver has caught up?
```

Also run the domain through <https://mxtoolbox.com/SuperTool.aspx> (SPF, DMARC and DKIM lookups, including the SPF lookup count) and the Microsoft 365 admin center **Domains > Check health**.

### 6.3 End-to-end

1. **mail-tester:** temporarily set `RECIPIENT_EMAIL` (or a test submitter email) to the one-off address shown at <https://www.mail-tester.com>, submit the form, and aim for 9/10 or better. It shows SPF, DKIM, DMARC, the blocklists and the raw headers.
2. **Real inboxes:** submit to `credit@woodhallfinanceltd.com`, to an external Gmail address and to an Outlook.com address. In each, open the message source (Outlook: File > Properties > Internet headers; Gmail: Show original) and check `Authentication-Results`. Expect:
   - `spf=pass smtp.mailfrom=woodhallfinanceltd.com`
   - `dkim=pass header.d=woodhallfinanceltd.com`
   - `dmarc=pass`
   - `compauth=pass`

   Paste the headers into Microsoft's Message Header Analyzer (<https://mha.azurewebsites.net>) to read them more easily.
3. **Exchange admin center** (<https://admin.exchange.microsoft.com>) > Mail flow > **Message trace**: confirm both messages left the `no-reply@` mailbox and were delivered.
4. **Maximum-size test:** submit with the full 20 MB of uploads and confirm the notification arrives with every attachment.
5. **Failure handling:** temporarily set an invalid client secret and confirm the form shows the existing "failed to send" error rather than silently succeeding.

---

## 7. `config.php` changes

**Values that change in every option:**

```php
define('RECIPIENT_EMAIL',   'credit@woodhallfinanceltd.com');
define('RECIPIENT_NAME',    'Woodhall Finance Credit Team');
define('MAIL_FROM_ADDRESS', 'no-reply@woodhallfinanceltd.com');
define('MAIL_FROM_NAME',    'Woodhall Finance');
```

The email templates in `lib/mailer.php` still say "Woodhall Capital" in the footer, the sign-off and the confirmation subject line. Update these to match the brand.

**Option 2 (recommended):** new settings, with the secret kept out of git:

```php
// config.php (committed)
define('MAIL_TRANSPORT', 'graph');            // 'graph' | 'smtp' | 'mail'
define('GRAPH_TENANT_ID', '<directory-tenant-id>');
define('GRAPH_CLIENT_ID', '<application-client-id>');
define('GRAPH_SENDER',    'no-reply@woodhallfinanceltd.com');
if (file_exists(__DIR__ . '/config.local.php')) {
    require __DIR__ . '/config.local.php';    // defines GRAPH_CLIENT_SECRET; already in .gitignore
}

// config.local.php (NOT committed; upload to Bluehost by hand)
define('GRAPH_CLIENT_SECRET', '<secret value>');   // expires <date>, rotate before then
```

The existing `SMTP_*` constants can stay empty, or be removed once the Graph transport is the only one. Set `config.local.php` to permissions `600`, and make sure the web server will not serve it (it is PHP, so it executes rather than displays, but check this).

**Option 1a (stop-gap only):**

```php
define('SMTP_HOST', 'smtp.office365.com');
define('SMTP_PORT', 587);
define('SMTP_SECURE', 'tls');
define('SMTP_USERNAME', 'no-reply@woodhallfinanceltd.com');  // must be a LICENSED user mailbox for basic auth
define('SMTP_PASSWORD', '<from config.local.php>');
```

---

## 8. Not verified (needs tenant access or a live test)

- Whether DKIM signing is already **enabled** for woodhallfinanceltd.com in Defender. DNS shows only that the CNAMEs are published.
- Whether **Security Defaults** is on, and whether SMTP AUTH is enabled at org or mailbox level.
- That the tenant's initial domain is `woodhallcapital647.onmicrosoft.com` (inferred from the DKIM CNAME).
- Whether woodhallcap.com and woodhallfinanceltd.com are in the same tenant.
- Whether Bluehost blocks outbound port 587 for this account. The public source I found is a third-party list, not Bluehost.
- The actual outbound IP that Bluehost `mail()` uses, and Bluehost's sending caps.
- Whether cPanel Email Routing is set to Local or Remote for either domain.
- Whether cPanel re-creates autodiscover records after they are deleted.
- The tenant's `MaxSendSize` (assumed to be the 35 MB default).
- The exact Graph size limit for MIME `sendMail`. Sources say about 4 MB, so test it.
- Behaviour of large-attachment upload sessions on a **shared** mailbox under app-only access (Microsoft lists a known issue for shared and delegated mailboxes).
- Whether Microsoft has changed the SMTP AUTH timeline after the January 2026 update. Check the Message Center for MC786329.

## 9. Sources

- Microsoft Message Center MC786329 (mirror): <https://mc.merill.net/message/MC786329>
- Exchange Team: Updated SMTP AUTH Basic Authentication deprecation timeline (Jan 2026): <https://techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835>
- Exchange Team: original retirement announcement (Apr 2024): <https://techcommunity.microsoft.com/blog/exchange/exchange-online-to-retire-basic-auth-for-client-submission-smtp-auth/4114750>
- Office 365 for IT Pros, SMTP AUTH retirement delayed: <https://office365itpros.com/2026/01/29/smtp-auth-basic-retirement/>
- Japanese Exchange support blog, same update: <https://jpmessaging.github.io/blog/Updated-Exchange-Online-SMTP-AUTH-Basic-Authentication-Deprecation-Timeline/>
- Enable or disable SMTP AUTH in Exchange Online: <https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission>
- How to set up a device or application to send email using Microsoft 365: <https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365>
- Authenticate IMAP, POP or SMTP using OAuth: <https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth>
- PHPMailer, Microsoft Azure and XOAUTH2 setup guide: <https://github.com/PHPMailer/PHPMailer/wiki/Microsoft-Azure-and-XOAUTH2-setup-guide>
- Graph user: sendMail: <https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0>
- Graph, attach large files: <https://learn.microsoft.com/en-us/graph/outlook-large-attachments>
- Microsoft Q&A, sendMail request size limit: <https://learn.microsoft.com/en-us/answers/questions/1824204/graph-api-user-sendmail-request-size-limit>
- Entra client credentials flow: <https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow>
- Entra, register an application: <https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app>
- RBAC for Applications in Exchange Online: <https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac>
- Office 365 for IT Pros, Mail.Send with RBAC for Applications: <https://office365itpros.com/2026/02/17/mail-send-rbac-for-applications/>
- About shared mailboxes: <https://learn.microsoft.com/en-us/microsoft-365/admin/email/about-shared-mailboxes>
- Connect your domain by adding DNS records: <https://learn.microsoft.com/en-us/microsoft-365/admin/get-help-with-domains/create-dns-records-at-any-dns-hosting-provider>
- Set up SPF: <https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure>
- Set up DKIM: <https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure>
- Set up DMARC: <https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure>
- Bluehost, DNS records for email services: <https://www.bluehost.com/help/article/bh-email-dns-email-services>
- WP Mail SMTP, hosts that block SMTP (third-party claim about Bluehost): <https://wpmailsmtp.com/why-your-web-host-blocked-smtp/>
