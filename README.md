# Simples Apuração RTC

Plataforma de apuração assistida de **IBS/CBS** — Reforma Tributária do Consumo (LC 214/2025).

## Visão Geral

Processa XMLs fiscais (NF-e, NFC-e, CT-e, NFS-e) **100% no navegador do usuário**, sem enviar dados a servidores. Conformidade com LGPD por design.

## Documentos Suportados

| Documento | Modelo | Status |
|---|---|---|
| NF-e | 55 | 🚧 Sprint 1 |
| NFC-e | 65 | 🚧 Sprint 1 |
| CT-e | 57 | 🚧 Sprint 1 |
| NFS-e Nacional | SNNFSe | 🚧 Sprint 1 |

## Stack

- **Next.js 15** + TypeScript 5
- **Tailwind CSS 4**
- **Zustand** (estado in-memory)
- **fast-xml-parser** + **JSZip** + **SheetJS**
- **Recharts** (gráficos)
- **Vitest** (testes unitários)

## Instalação

```bash
npm install
npm run dev
```

## Testes

```bash
npm test               # roda testes unitários
npm run test:coverage  # com relatório de cobertura
```

## Estrutura

```
src/
├── domain/models/        → Tipos e interfaces do domínio fiscal
├── infrastructure/parsers/ → Parsers por tipo de documento
├── application/services/ → TaxAnalyzerService, ExportService
├── application/store/    → Zustand store (in-memory)
├── components/           → Componentes React
└── app/                  → Páginas Next.js (App Router)
docs/                     → PRD, SPEC e decisões arquiteturais
tests/                    → Testes unitários e fixtures
```

## Sprints

| Sprint | Escopo | Status |
|---|---|---|
| 0 | Fundação: estrutura, domínio, skeletons | ✅ Concluído |
| 1 | Parsers completos + testes unitários | 🔜 Próximo |
| 2 | TaxAnalyzerService + Store + regras de negócio | ⏳ |
| 3 | UI: Upload + Explorador | ⏳ |
| 4 | UI: Dashboard + Relatórios | ⏳ |
| 5 | Exportação Excel + polimento | ⏳ |

## Referências

- [PRD v2](docs/PRD_v2.md)
- [SPEC XML Mapping](docs/SPEC_XML_MAPPING_v2.md)
- [SPEC Business Rules](docs/SPEC_BUSINESS_RULES.md)
- [gov.br/nfse](https://www.gov.br/nfse) — NFS-e Nacional
