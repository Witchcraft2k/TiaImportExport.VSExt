# Release Compliance Checklist (VSIX)

Use this checklist before every public or internal release.

## 1) Scope and version

- [ ] `package.json` version is updated for the release.
- [ ] `README.md` and changelog/release notes match the shipped features.
- [ ] `THIRD_PARTY_NOTICES.md` is updated to current dependency graph.

## 2) License and notices

- [ ] Project license file (`LICENSE`) is present in repository.
- [ ] `package.json` contains correct `license` field.
- [ ] Third-party license attributions are preserved (MIT/Apache/BlueOak and others if present).
- [ ] No third-party copyright/licensing notices were removed from redistributed artifacts.

## 3) Siemens / TIA Openness constraints (critical)

- [ ] Release documentation states end users must have their own valid TIA Portal + Openness license.
- [ ] `Siemens.Engineering.*` binaries are **not** bundled in VSIX unless explicitly allowed by Siemens terms for your scenario.
- [ ] Siemens package terms were re-checked for intended distribution model (public marketplace/internal/company-only).
- [ ] Export-control/regional restrictions were reviewed where applicable.

## 4) Dependency audit

- [ ] Runtime npm dependency licenses were re-checked.
- [ ] NuGet dependency licenses/terms were re-checked.
- [ ] Any new non-permissive or unclear license is reviewed before release.
- [ ] Dependency lock state and resolved versions are reproducible for the build.

## 5) Build and artifact checks

- [ ] TypeScript build passes (`npm run compile`).
- [ ] .NET wrapper build passes (`npm run build:dotnet` or task equivalent).
- [ ] VSIX package builds successfully (`npm run package`).
- [ ] VSIX content was inspected for unintended binaries/secrets/temp files.

## 6) Security and operational safeguards

- [ ] README includes risk/disclaimer language for engineering changes and deployment validation.
- [ ] No credentials, private keys, or internal paths are included in packaged outputs.
- [ ] Supported platform and version requirements are clearly documented.

## 7) Final release gate

- [ ] Legal/compliance owner approval (if required by your organization).
- [ ] Technical owner approval.
- [ ] Release decision recorded (date, version, approver).

---

## Minimal release log template

- Version:
- Date:
- Distribution channel (Marketplace/Internal/Other):
- Siemens terms check: Pass / Needs review
- Third-party notices updated: Yes / No
- `Siemens.Engineering.*` bundled: No / Yes (if Yes: documented legal basis)
- Approver:
