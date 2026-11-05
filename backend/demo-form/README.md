# Demo request backend (not served by the site)

AWS us-east-2, CloudFormation stack `BoiaFreight-DemoForm` (`stack.yaml`), tagged Project=BOIA-Freight, Env=prod-site.

- Lambda `boiafreight-demo-request` (Node 22, arm64, 128 MB) behind a Function URL
- Amplify rewrite: `/api/demo` -> the Function URL (status 200 proxy), so the site posts same-origin
- DynamoDB `boiafreight-demo-rl` (on-demand, TTL): 5 requests per IP per hour
- SES: domain identity `boiafreight.com` (DKIM in Route 53), sends from `no-reply@boiafreight.com`
- Recipient: stack parameter `ToAddress` (NoEcho) -> Lambda env `TO_ADDRESS`. Never in site code.
- Turnstile secret: SSM SecureString `/boiafreight/site/turnstile-secret`. While it is `UNSET` the API returns 503 `not_open`.

## Opening the form (Cloudflare Turnstile)

1. Free Cloudflare account -> Turnstile -> Add widget.
   Name: BOIA Freight demo form. Hostnames: `boiafreight.com`, `www.boiafreight.com`. Mode: Managed.
2. Secret key -> SSM (do not paste it in chat or code):
   `aws ssm put-parameter --region us-east-2 --name /boiafreight/site/turnstile-secret --type SecureString --overwrite --value '<SECRET>'`
   (or AWS console -> Systems Manager -> Parameter Store -> edit value). The Lambda reads it on the next request.
3. Site key (public) -> `index.html`, one line: `data-sitekey=""` -> `data-sitekey="<SITE KEY>"`. Merge to main; Amplify deploys.

## Code update
Zip `index.mjs` alone (the runtime provides the AWS SDK), upload to the CDK assets bucket under `boiafreight-demo/`, then `aws cloudformation deploy ... --parameter-overrides CodeKey=<new key>` (other params keep previous values with `--parameter-overrides ToAddress=... `).

Tests: `npm i --no-save @aws-sdk/client-ses @aws-sdk/client-dynamodb @aws-sdk/client-ssm && node --test test.mjs`
