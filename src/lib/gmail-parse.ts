// MOVED — this logic now lives in the separate gc-email-agent service
// (gc-email-agent/lib/gmail-parse.ts), which owns all Gmail access.
// This app no longer imports Gmail directly; see src/app/api/gmail/sync/route.ts,
// which just proxies to that service. Left here (rather than deleted) only
// because this environment doesn't allow deleting output files once written.
export {};
