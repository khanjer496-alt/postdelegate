# Owner decisions on the legal pages

The seven decisions the launch tracker was holding, decided on 6 November 2026,
with what each one changed. Three needed no change: the pages already said what
we decided. One cannot be finished without buying a service, and is the only
item here still open.

## 1. Refund window and the EU right to withdraw — CHANGED

**Decided:** a full refund of a workspace's first paid invoice if asked for
within 14 days, once per workspace, on monthly and yearly plans alike. After
that, fees stay non-refundable.

The 7-day trial takes no card, so almost nobody pays before they have used the
product; the exposure is one month of one plan, and only for a customer who
asked within two weeks. The old wording ("non-refundable ... except where the
law requires otherwise") pushed every EU consumer into reading a carve-out to
find a right they already had, which reads as if we hoped they would not look.

**Also added:** the EU, EEA and UK consumer right to withdraw within 14 days,
written out — how to exercise it, that starting the service immediately means a
proportionate charge for the days used, and that a full first-invoice refund
satisfies it. It excludes business subscriptions, which is where the Consumer
Rights Directive puts the line.

A refund reverses the affiliate commission on that invoice, which the affiliate
terms already provided for.

## 2. Notice before a price change — NO CHANGE

**Decided: 30 days**, which `terms.html` already said ("at least 30 days'
notice, effective from your next renewal"). It is the common SaaS figure, it is
longer than a monthly billing cycle so a customer can always leave before
paying the new price, and nothing about the business argues for more.

## 3. How long billing records are kept — CHANGED

**Decided: 7 years** after the account or workspace closes, longer only where a
tax authority requires it or while a dispute or chargeback is unresolved.

The privacy policy said "as long as needed for tax, accounting and legal
obligations", which is not a retention period — it is a promise to decide
later, and under GDPR Art. 13(2)(a) the period or the criteria must be stated.
7 years covers the US federal record-keeping we are actually subject to as a
Wyoming LLC and the longest ordinary EU VAT periods. The entry now also says
what those records hold (billing contact, amounts, Stripe and PayPal
references) and what they do not (posts, channel credentials).

## 4. Art. 27 representative or a DPO — DECIDED, ONE PART OPEN

**Decided: no data protection officer.** Not required of us, and the policy now
says so and why: we are not a public authority, and we do no large-scale
special-category processing or systematic monitoring, which is what GDPR
Art. 37 turns on. Privacy mail goes to support@postdelegate.com. The policy
also now tells people they can complain to their own supervisory authority, or
the ICO in the UK, without coming to us first.

**Open: the EU and UK representatives must be appointed, and only Naser can do
it.** A US company with no EU establishment that offers a service to people in
the EU needs a representative in the EU under Art. 27, and a separate one in
the UK under the UK GDPR. There is no exemption we fit: the one in Art. 27(2)
is for occasional, low-risk processing, and a subscription product holding
social-account tokens is neither. It is a paid appointment (roughly
EUR 200-500 a year for each, from a service such as Prighter, DataRep or
VeraSafe) and it needs a signed mandate, so it cannot be done from here.

Nothing was written into the policy claiming a representative exists. The
paragraph to publish the day one is appointed, with the name and address filled
in, is:

> **Our representatives.** Nasida Apps LLC has no establishment in the EU or
> the UK. Under Article 27 of the GDPR our representative in the EU is
> <name, full address, email>, and under Article 27 of the UK GDPR our
> representative in the UK is <name, full address, email>. You may contact
> either of them, in place of us, about anything to do with the processing of
> your personal data. Contacting a representative does not affect your right to
> complain to a supervisory authority.

It belongs in section 17, next to the DPO paragraph, and the "What changed"
note at the top of the policy should say the representatives were appointed.

Until then we are offering the service to EU customers without a representative
in place. That is a real, if common, gap for a company this size, and it is the
one legal item that should close before paid EU sign-ups open.

## 5. Affiliate payouts — NO CHANGE

**Decided: monthly, by PayPal, above a USD 50 balance**, which
`affiliate-terms.html` already said, together with the roll-over of smaller
balances, payment in US dollars, who pays the provider's fees, and reversal on
refund or chargeback. Confirmed as written.

## 6. Skool — DECIDED: STAYS HIDDEN

Skool has no official public posting API. The provider in the codebase works
against endpoints that can change without notice, which is the wrong thing to
put in front of a paying customer at launch, and "coming soon" is a promise we
would not control the date of. It stays in `HIDDEN_PROVIDERS` with no date
attached; the one-line server change is to keep `skool` in that list in
`/opt/postiz/runtime.env`. Revisit if Skool publishes a real API.

## 7. The referral-consent text — APPROVED AS WRITTEN

The wording shipped in PR #96 and has been live since 2 November. Re-read on
6 November against what the code does: it asks before the referral cookie, the
saved campaign source or any analytics are stored; it says that rejecting still
lets an attribution happen if you sign up in that same visit, because the code
travels in the link rather than in storage; it names the `pd_consent` cookie
and its 6-month life; and it is honest that a referral cookie set before the
banner existed can still be used until it expires. That matches the
implementation, so it is approved unchanged.

## Not a decision, still Naser's: the Stripe brand icon and tax address

Stripe shows an orange "N" in the billing portal and some emails, and Stripe
Tax wants a head-office address before it can collect VAT or sales tax. Both
live in the Stripe dashboard behind his login.
