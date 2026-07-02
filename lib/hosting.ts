/*
  Open-core hosting seam.

  ReviewIQ is one AGPL-licensed codebase. The "hosted" (paid, managed) tier is
  NOT different code — it's the same repo running on the maintainer's infra with
  HOSTED=true set. This flag is the single place hosted-only behavior branches
  (billing, accounts, the host's own API key, rate limits, managed DB), so
  self-hosters run the identical code with the flag off and nothing hidden.

  Self-host (default): HOSTED unset → single-tenant, bring-your-own-key, no billing.
  Hosted: HOSTED=true on the maintainer's deploy → managed behavior.
*/

/** True only on the managed/hosted deployment. */
export function isHosted(): boolean {
  return process.env.HOSTED === "true" || process.env.HOSTED === "1";
}
