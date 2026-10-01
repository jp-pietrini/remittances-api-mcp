# Changelog

All notable changes to the MCP server and API description.

## Unreleased

### Added
- Offline test suite (`npm test`) running the server against a mock API.
- GitHub Actions CI on Node 18, 20 and 22.
- Dependency-free Node quickstart example.
- Issue templates, `CONTRIBUTING.md` and `SECURITY.md`.

### Fixed
- Network failures and timeouts now return a tool error instead of a
  JSON-RPC internal error; requests time out after 30 seconds.
- Tool arguments are validated against their input schema before any request.
- Corrected the server path in the usage comment.

## 1.0.0

- Initial release: MCP server (six tools), OpenAPI description, reference
  Next.js route handlers and curl/pandas examples.
