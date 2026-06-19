# Simples Apuração RTC

> Plataforma de apuração assistida de **IBS/CBS** — Reforma Tributária do Consumo (LC 214/2025)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Testes](https://img.shields.io/badge/Testes-83%20passed-green)](./tests)
[![Licença](https://img.shields.io/badge/Licença-Privado-red)]()

---

## O que é

O **Simples Apuração RTC** é uma ferramenta web que permite a contadores, analistas fiscais e gestores tributários processar lotes de documentos fiscais XML e apurar automaticamente os créditos e débitos de **IBS** (Imposto sobre Bens e Serviços) e **CBS** (Contribuição sobre Bens e Serviços), os tributos que substituem progressivamente ICMS, ISS, PIS e COFINS a partir de 2026.

---

## Princípio de Privacidade (LGPD)

**Zero transmissão de dados.** Todo o processamento acontece exclusivamente no navegador do usuário. Nenhum XML, CNPJ ou valor financeiro é enviado a servidores externos. Os dados existem apenas na memória da sessão e são descartados ao fechar a aba.

```
Disco do usuário → Memória do browser → Análise → Exportação local → Descarte
```

---

## Documentos Fiscais Suportados

| Documento | Modelo | Leiaute | IBS/CBS |
|---|---|---|---|
| NF-e  — Nota Fiscal Eletrônica               | 55 | 4.00   | ✅ Por item |
| NFC-e — Nota Fiscal de Consumidor Eletrônica  | 65 | 4.00   | ✅ Por item |
| CT-e  — Conhecimento de Transporte Eletrônico | 57 | 4.00   | ✅ Nível documento |
| NFS-e — Nota Fiscal de Serviços (padrão nacional SNNFSe) | — | 1.01 | ✅ Nível documento |

> NFS-e no padrão ABRASF municipal não é suportado. Utilize o padrão nacional (gov.br/nfse).

---

## Funcionalidades

### Upload e Processamento
- Drag & drop ou seleção de arquivos `.xml` e `.zip`
- Processamento de lotes (testado com mais de 3.000 documentos)
- Detecção automática do tipo de documento por análise estrutural do XML
- Detecção automática do CNPJ raiz da empresa analisada (por frequência)
- Override manual do CNPJ raiz
- Log técnico de processamento em tempo real

### Explorador de Documentos
- Tabela filtrável por tipo, direção (INBOUND/OUTBOUND), regime tributário e presença de IBS/CBS
- Busca por CNPJ, nome ou chave de acesso
- Ordenação por data, valor, tipo e direção
- Paginação (25 documentos por página)
- Modal lateral com detalhes completos: participantes, tributos por item, totais

### Apuração RTC
- **Créditos IBS/CBS**: total creditado + índice % sobre valor das entradas
- **Débitos IBS/CBS**: total debitado + índice % sobre valor das saídas
- **Saldo do período**: posição credora ou devedora + índice % sobre volume total
- Gráfico de barras: crédito e débito por CFOP (top 12)
- Gráfico de pizza: distribuição por CST
- Tabela resumo por tipo de documento

### Relatório de Conformidade
- Taxa de conformidade da carteira de fornecedores
- Lista de documentos RPA sem IBS/CBS (2026+)
- Ranking de fornecedores inconformes por volume
- Critérios documentados (RPA + 2026 + operação comercial + IBS/CBS = 0)

### Exportação
- **Excel (.xlsx)** com 2 abas:
  - `Documentos`: visão por cabeçalho (1 linha por documento)
  - `Itens Analítico`: desnormalizado por item, pronto para Pivot Table, com todos os campos da Reforma
- **CSV**: relatório de inconformes (acionado na tela de Conformidade)

---

## Lógica de Apuração

### Regra central: Direção como driver

O crédito ou débito de IBS/CBS é determinado pela **posição da empresa analisada** na transação, não pelo CFOP.

| Direção | Resultado |
|---|---|
| INBOUND (empresa = destinatário) | **CRÉDITO** — empresa recebe o insumo e se credita do IBS/CBS destacado |
| OUTBOUND (empresa = emitente) | **DÉBITO** — empresa emite e gera obrigação de recolhimento |

O CFOP é usado apenas para **filtrar operações não-comerciais** (brindes, remessas, exportações) que recebem impacto NEUTRO.

### Detecção do CNPJ raiz
O sistema identifica automaticamente a empresa analisada contando a frequência de aparição de cada CNPJ raiz (8 primeiros dígitos) entre emitentes e destinatários de todos os documentos carregados. O CNPJ raiz com maior frequência é assumido como a empresa analisada. O usuário pode sobrescrever manualmente.

### Índices Percentuais
- **Índice de Crédito** = IBS/CBS creditados ÷ valor total das compras (INBOUND)
- **Índice de Débito** = IBS/CBS debitados ÷ valor total das vendas (OUTBOUND)
- **Índice de Saldo** = saldo líquido ÷ volume total transacionado

Esses índices representam a carga efetiva do novo tributo sobre as operações da empresa.

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript 5.x (strict mode, sem `any`) |
| Estilização | Tailwind CSS 4.x + CSS Variables |
| Estado | Zustand 5 (in-memory, sem persistência) |
| Parsing XML | fast-xml-parser 5 |
| Descompressão ZIP | JSZip 3 |
| Gráficos | Recharts 3 |
| Exportação Excel | SheetJS (xlsx) |
| Testes | Vitest 3 |
| Deploy | Vercel (estático) |

---

## Arquitetura

O projeto segue **Clean Architecture** com separação rígida entre camadas:

```
src/
├── domain/
│   └── models/
│       └── FiscalDocument.ts     ← Entidades, tipos e interfaces do domínio fiscal
│
├── infrastructure/
│   └── parsers/
│       ├── IXmlParser.ts         ← Interface (contrato) de todos os parsers
│       ├── DocumentDetector.ts   ← Detecção de tipo por regex (sem parse completo)
│       ├── ParserFactory.ts      ← Factory: seleciona o parser correto por tipo
│       ├── ParserNFe.ts          ← NF-e modelo 55
│       ├── ParserNFCe.ts         ← NFC-e modelo 65 (estende ParserNFe)
│       ├── ParserCTe.ts          ← CT-e modelo 57
│       └── ParserNFSe.ts         ← NFS-e Nacional (SNNFSe/DPS)
│
├── application/
│   ├── services/
│   │   ├── TaxAnalyzerService.ts ← Enriquecimento, direção, impacto RTC, apuração
│   │   └── ExportService.ts      ← Excel e CSV client-side
│   └── store/
│       └── useFiscalStore.ts     ← Estado global Zustand (sessão apenas)
│
├── components/
│   ├── ui/                       ← Badge, Button, Card, EmptyState
│   ├── upload/                   ← UploadZone
│   ├── explorer/                 ← DocumentDetailsModal
│   └── layout/                   ← Sidebar, Header
│
└── app/                          ← Páginas Next.js (App Router)
    ├── page.tsx                  ← / Upload
    ├── explorer/page.tsx         ← /explorer Explorador
    ├── analysis/page.tsx         ← /analysis Apuração RTC
    └── reports/page.tsx          ← /reports Conformidade
```

**Princípio de extensibilidade**: para adicionar suporte a um novo tipo de documento, basta criar uma nova classe que implemente `IXmlParser` e registrá-la no `ParserFactory`. Nenhuma outra camada precisa ser alterada.

---

## Instalação e Uso

### Pré-requisitos
- Node.js 20+
- npm 10+

### Instalação
```bash
git clone https://github.com/CamargoRomuloNegi/Simples-Apuracao-RTC.git
cd Simples-Apuracao-RTC
npm install
```

### Desenvolvimento
```bash
npm run dev
# Acesse http://localhost:3000
```

### Testes
```bash
npm test                # 83 testes unitários
npm run test:coverage   # com relatório de cobertura
```

### Build de produção
```bash
npm run build
npm start
```

---

## Testes

83 testes unitários cobrindo as camadas de maior criticidade:

| Suíte | Testes | Cobertura |
|---|---|---|
| `DocumentDetector` | 6 | Detecção dos 4 tipos + rejeição ABRASF |
| `ParserNFe` | 22 | RPA com IBS/CBS, Simples sem IBS, multi-item, erros |
| `ParserNFCe` | 11 | Consumidor anônimo, identificado, multi-item |
| `ParserCTe` | 12 | RPA com IBS/CBS (CST 000), interestadual, erros |
| `ParserNFSe` | 12 | Com IBSCBS, sem IBSCBS, erros |
| `TaxAnalyzerService` | 20 | CNPJ raiz, direção, impacto RTC, apuração, inconformes |

Todos os testes utilizam **XMLs reais anonimizados** (CNPJ, nomes e endereços substituídos; valores financeiros e campos fiscais preservados).

---

## Documentação Interna

| Arquivo | Conteúdo |
|---|---|
| [docs/PRD_v2.md](docs/PRD_v2.md) | Visão de produto, escopo MVP, personas, roadmap |
| [docs/SPEC_XML_MAPPING_v2.md](docs/SPEC_XML_MAPPING_v2.md) | Mapeamento XML → modelo para os 4 tipos de documento |
| [docs/SPEC_BUSINESS_RULES.md](docs/SPEC_BUSINESS_RULES.md) | Regras de negócio: crédito/débito IBS/CBS, conformidade, CST |

---

## Roadmap

### MVP Atual (Sprint 0–2) ✅
- Parsers completos para NF-e, NFC-e, CT-e, NFS-e
- Apuração de créditos e débitos com índices percentuais
- Explorador de documentos com filtros e modal de detalhes
- Relatório de conformidade com ranking de fornecedores
- Exportação Excel analítica (2 abas) e CSV

### Próximas Evoluções
- **Módulo de IA**: análise semântica de NCM/CST, sugestão de regime tributário, detecção de anomalias
- **Análise temporal**: apuração por período/mês com gráficos de tendência
- **Matching CT-e ↔ NF-e**: vinculação automática pelas chaves referenciadas
- **Relatório executivo PDF**: sumário da apuração para apresentação a gestores
- **Versão comercial**: persistência opcional (opt-in), histórico de apurações, multi-empresa

---

## Base Legal

- **EC 132/2023** — Emenda Constitucional da Reforma Tributária
- **LC 214/2025** — Lei Complementar que institui IBS e CBS
- **NTs SEFAZ/RFB 2024–2026** — Notas Técnicas de leiaute para inclusão dos campos IBSCBS nos XMLs fiscais
- **SNNFSe v1.01** — Sistema Nacional de NFS-e (sped.fazenda.gov.br/nfse)

---

*Desenvolvido com Next.js 15 + TypeScript. Processamento 100% client-side — seus dados ficam no seu dispositivo.*
