# Referência da API 4884 — para configurar requisições GET no n8n

API REST que retorna dados de **cursos**, **polos** e **pré-requisitos de 2ª graduação** de uma instituição de ensino. Todas as respostas são JSON no formato `{ "ok": boolean, "data": ..., "meta": ... }`.

## Regras gerais

- **URL base:** `hhttps://four884-api.onrender.com` 
- **Autenticação:** todas as rotas exigem o header `x-api-key: ZuGg7AXeOvX04XeEDiFzkzmdPW3BVbKntwfgK4bUmBQ=`. Exceção: `GET /health`, que é público.
- **Método:** todas as rotas de consulta são `GET`. Apenas `/refresh` é `POST`.
- **Erros** também vêm em JSON: `{ "ok": false, "error": "mensagem" }`. Códigos: `400` (parâmetro faltando), `401` (api key inválida/ausente), `404` (não encontrado), `500` (erro interno).
- **Matching de texto** (cidade, curso, formação) é tolerante: ignora acentos, maiúsculas/minúsculas e pontuação, e aceita correspondência parcial. Ex.: `formacao=direito` casa com `"BACHARELADO EM DIREITO"`.
- **Cold start:** no plano Free do Render, a primeira requisição após inatividade pode levar ~50s. Use timeout ≥ 60s no nó HTTP Request.

---

## 1. GET /health — status do serviço (sem api key)

Verifica se a API está no ar. Útil como teste inicial.

```
GET https://SEU-SERVICO.onrender.com/health
```

Resposta:
```json
{ "ok": true, "data": { "status": "up", "cache": { "carregado": true, "idadeSegundos": 7, "ttlMinutos": 60 } } }
```

---

## 2. GET /polos — polos por localização

Filtra os polos físicos. Todos os parâmetros são opcionais e combináveis.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `uf` | string | Sigla do estado, 2 letras (ex: `AL`, `SP`). **Envie sempre junto com `cidade`**: evita confundir cidades com o mesmo nome em estados diferentes. |
| `cidade` | string | Nome da cidade (parcial, sem acento). Ex: `arapiraca`. |
| `bairro` | string | (Opcional, só vale junto com `cidade`) Bairro do lead. Quando enviado, os polos vêm ordenados do mais próximo ao mais distante do bairro, com `distanciaKm`. Ver abaixo. |
| `cep` | string | Filtra por prefixo do CEP (ex: `573` pega todos que começam com 573). |
| `megaPolo` | boolean | `true` retorna só os polos principais; `false` os demais. |
| `limite` | número | Só vale no fallback: quantas cidades próximas retornar. Padrão `5`. |

```
GET https://SEU-SERVICO.onrender.com/polos?uf=AL&cidade=arapiraca
```

Resposta (há polo na cidade → `meta.fallback: false`):
```json
{
  "ok": true,
  "data": [
    {
      "uf": "AL",
      "estado": "Alagoas",
      "cidade": "ARAPIRACA (CENTRO)",
      "endereco": "AV VENTURA DE FARIAS Nº388 - ELDORADO",
      "cep": "57300510",
      "megaPolo": false,
      "geo": { "municipio": "Arapiraca", "uf": "AL", "lat": -9.75, "lon": -36.66 }
    }
  ],
  "meta": { "total": 1, "fallback": false }
}
```

### Fallback: cidade sem polo → polos mais próximos em km

Quando a busca tem `cidade` e **não há polo nela**, a API devolve os polos das cidades mais próximas (padrão: 5 cidades), ordenados por distância. A distância é **em linha reta** e calculada a partir das coordenadas dos municípios do IBGE. A busca **não fica presa à UF**: se o polo mais perto for em outro estado, ele aparece.

```
GET https://SEU-SERVICO.onrender.com/polos?uf=AL&cidade=quebrangulo
```

```json
{
  "ok": true,
  "data": [
    { "cidade": "PALMEIRA DOS ÍNDIOS", "uf": "AL", "endereco": "...", "distanciaKm": 20, "geo": { "municipio": "Palmeira dos Índios", "uf": "AL" } },
    { "cidade": "GARANHUNS", "uf": "PE", "endereco": "...", "distanciaKm": 49, "geo": { "municipio": "Garanhuns", "uf": "PE" } }
  ],
  "meta": {
    "total": 2,
    "fallback": true,
    "motivo": "sem_polo_na_cidade",
    "cidadeBuscada": { "nome": "Quebrangulo", "uf": "AL" }
  }
}
```

| Campo | Significado |
|---|---|
| `meta.fallback` | `false`: os polos ficam na cidade buscada. `true`: **não há polo na cidade**, e a lista traz os mais próximos. |
| `data[].distanciaKm` | Distância aproximada, em km e em linha reta, da cidade buscada até o polo. Só aparece no fallback. |
| `meta.cidadeBuscada` | Nome oficial e UF da cidade que a API reconheceu. |
| `meta.aviso` | Quando não dá para calcular o fallback: cidade não encontrada, ou nome repetido em vários estados sem `uf` (nesse caso vem também `meta.candidatos` com as opções). |

### Com bairro: polos mais próximos do bairro

Se `bairro` for enviado junto com `cidade`:

- **Há polo na cidade:** a lista traz os polos da cidade ordenados pela distância até o bairro (`data[].distanciaKm`, com uma casa decimal) e `meta.ordenadoPor: "distancia_do_bairro"`.
- **Não há polo na cidade:** o fallback funciona como descrito acima, mas a distância é medida a partir do bairro.
- **Bairro não localizado:** a resposta é a mesma de uma busca sem bairro, com `meta.bairroLocalizado: false` e um `meta.aviso`.

Sem `bairro`, nada muda.

```
GET https://SEU-SERVICO.onrender.com/polos?uf=DF&cidade=brasilia&bairro=ceilandia
```

```json
{
  "ok": true,
  "data": [
    { "cidade": "BRASÍLIA (CEILÂNDIA)", "uf": "DF", "endereco": "QNN 18, conj. H lote 17 - CEILÂNDIA SUL", "distanciaKm": 0.6 },
    { "cidade": "BRASÍLIA (TAGUATINGA)", "uf": "DF", "endereco": "...", "distanciaKm": 5.4 }
  ],
  "meta": {
    "total": 8,
    "fallback": false,
    "ordenadoPor": "distancia_do_bairro",
    "bairroBuscado": { "nome": "ceilandia", "cidade": "Brasília", "uf": "DF" },
    "bairroLocalizado": true
  }
}
```

A localização do bairro vem do OpenStreetMap (Nominatim) e a do polo vem do CEP dele (AwesomeAPI); as distâncias são em linha reta. Uma busca com bairro pode levar de 1 a 4 s a mais na primeira vez. As seguintes ficam em cache até o serviço reiniciar.

| Campo | Significado |
|---|---|
| `meta.bairroBuscado` | Bairro recebido e a cidade/UF em que ele foi procurado. |
| `meta.bairroLocalizado` | `true`: a lista está ordenada pela distância até o bairro. `false`: o bairro não foi encontrado, e a lista não foi reordenada. |
| `meta.ordenadoPor` | `"distancia_do_bairro"` quando os polos da cidade foram ordenados pelo bairro. |

**Sugestão para a descrição da tool no AI Agent:**
> Sempre envie `cidade` e `uf`. Se o lead tiver dito o bairro, envie também `bairro`, e a lista virá do polo mais próximo ao mais distante. Ofereça primeiro os primeiros da lista e cite a distância aproximada (`distanciaKm`). Se `meta.fallback` for `true`, diga ao lead que ainda não há polo na cidade dele e ofereça os polos listados como os mais próximos. Se vier `meta.aviso`, pergunte ao lead a informação que falta.

---

## 3. GET /cursos — lista de cursos

Lista os cursos distintos da grade, com modalidade e número de disciplinas.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `modalidade` | string | (Opcional) Filtra por modalidade. Ex: `Graduação`, `Segunda Licenciatura`. |

```
GET https://SEU-SERVICO.onrender.com/cursos
```

Resposta:
```json
{
  "ok": true,
  "data": [
    { "curso": "ADMINISTRAÇÃO", "modalidade": "Graduação", "totalDisciplinas": 52 }
  ],
  "meta": { "total": 94 }
}
```

---

## 4. GET /cursos/grade — grade de um curso

Retorna as disciplinas de um curso em ordem, com carga horária e total.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `curso` | string | **Sim** | Nome do curso (parcial, sem acento). Ex: `analise e desenvolvimento`. |
| `modalidade` | string | Não | Desempata quando há cursos com mesmo nome em modalidades diferentes. |

```
GET https://SEU-SERVICO.onrender.com/cursos/grade?curso=analise e desenvolvimento
```

Resposta:
```json
{
  "ok": true,
  "data": {
    "curso": "ANÁLISE E DESENVOLVIMENTO DE SISTEMAS",
    "modalidade": "Graduação",
    "totalDisciplinas": 35,
    "cargaHorariaTotal": 2100,
    "disciplinas": [
      { "ordem": 2, "disciplina": "PROCESSAMENTO DE LINGUAGEM NATURAL...", "cargaHoraria": 10 }
    ]
  },
  "meta": { "outrosCursosCorrespondentes": [] }
}
```

Se nenhum curso casar, retorna `404` com mensagem orientando consultar `GET /cursos`.

---

## 5. GET /prerequisitos — pré-requisitos de 2ª graduação

Lista os cursos de 2ª graduação e quais formações (diplomas) são aceitas para cada um.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `curso` | string | (Opcional) Filtra por nome do curso desejado. Sem o parâmetro, lista todos. |

```
GET https://SEU-SERVICO.onrender.com/prerequisitos?curso=administracao
```

Resposta:
```json
{
  "ok": true,
  "data": [
    {
      "curso": "ADMINISTRAÇÃO",
      "duracaoMeses": 12,
      "formacoesAceitas": ["BACHARELADO EM DIREITO", "BACHARELADO EM CIÊNCIAS CONTÁBEIS"]
    }
  ],
  "meta": { "total": 1 }
}
```

> Observação: um mesmo curso pode aparecer em mais de uma duração (ex: 6 e 12 meses), como entradas separadas.

---

## 6. GET /prerequisitos/verificar — checar elegibilidade

Responde se um aluno com determinada formação pode cursar a 2ª graduação desejada.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cursoDesejado` | string | **Sim** | Curso de 2ª graduação que o aluno quer fazer. Ex: `administracao`. |
| `formacao` | string | **Sim** | Formação/diploma que o aluno já possui. Ex: `direito`. |

```
GET https://SEU-SERVICO.onrender.com/prerequisitos/verificar?cursoDesejado=administracao&formacao=direito
```

Resposta:
```json
{
  "ok": true,
  "data": {
    "cursoDesejado": "administracao",
    "formacaoInformada": "direito",
    "elegivel": true,
    "opcoes": [
      {
        "curso": "ADMINISTRAÇÃO",
        "duracaoMeses": 12,
        "elegivel": true,
        "formacaoCorrespondente": "BACHARELADO EM DIREITO"
      }
    ]
  },
  "meta": { "total": 1 }
}
```

O campo `data.elegivel` é o resultado direto (`true`/`false`). `data.opcoes` detalha cada duração disponível para o curso.

---

## 7. GET /search — busca geral

Busca o termo nos 3 conjuntos de dados ao mesmo tempo. Bom quando a IA não sabe qual endpoint usar.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `q` | string | **Sim** | Termo de busca. Ex: `biomedicina`, `rio branco`. |

```
GET https://SEU-SERVICO.onrender.com/search?q=biomedicina
```

Resposta:
```json
{
  "ok": true,
  "data": {
    "polos": [],
    "cursos": [{ "curso": "BIOMEDICINA", "modalidade": "Graduação" }],
    "prerequisitos": []
  },
  "meta": { "totais": { "polos": 0, "cursos": 1, "prerequisitos": 0 }, "limitePorTipo": 20 }
}
```

---

## 8. POST /refresh — recarregar dados

Força a API a rebaixar os 3 documentos Google (use após editar as planilhas/doc).

```
POST https://SEU-SERVICO.onrender.com/refresh
```

---

## Como configurar no nó HTTP Request do n8n

Para cada rota acima:

1. **Method:** `GET` (ou `POST` no `/refresh`).
2. **URL:** a URL base + caminho da rota (ex: `https://SEU-SERVICO.onrender.com/prerequisitos/verificar`). **Não coloque os parâmetros na URL** — use o campo abaixo.
3. **Send Query Parameters:** ligado. Adicione cada parâmetro em **Name/Value** (ex: Name `cursoDesejado`, Value `administracao`).
4. **Send Headers:** ligado. Adicione Name `x-api-key`, Value = sua API key.
5. **Settings → Timeout:** `60000` ou mais (cold start do plano Free).

Para o **AI Agent** do n8n, cada rota pode virar uma *tool* (HTTP Request Tool), descrevendo os parâmetros conforme as tabelas acima. O formato de resposta `{ ok, data, meta }` é estável e fácil de a IA interpretar.
