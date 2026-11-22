# Tasks

## 1. The option

- [x] 1.1 `--proxy-host HOST[:PORT]`, repeatable, validated as `--metrics-host` is (one `host_header` type for both). `checked_host` accepts its names on every route.
- [x] 1.2 `same_site_only`: for a `--proxy-host` name, an `Origin` of `https://<host>` or `http://<host>` is same-site; for `127.0.0.1:<port>`, only `http://127.0.0.1:<port>`.
- [x] 1.3 Tests in `test_app.py` ("test_host_check_on_the_default_and_a_custom_port"): a proxy host gets a page, the relative `/` redirect, `/api` and a POST with its `https` Origin; a cross-site Origin or `Sec-Fetch-Site: cross-site` is refused; the name without its port is refused.

## 2. Docs

- [x] 2.1 README: the option in the options table and a section on opening the pages through `tailscale serve`, with the warning.
- [x] 2.2 Docs site: the CLI reference, the privacy and security page and the troubleshooting page.
- [x] 2.3 `CHANGELOG.md` `[Unreleased]`: the option.
