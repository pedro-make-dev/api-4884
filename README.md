# 4884 API — Cursos, Polos e Pré-requisitos

API em Node.js que consome 3 documentos Google (pré-requisitos de 2ª graduação, grade de cursos e polos) e expõe os dados em JSON simples, pensada para ser consumida por um agente de IA via nó **HTTP Request do n8n**. Hospedagem: **Render**.

## Como funciona

- Os 3 documentos são baixados ao vivo via link público de export do Google (Doc → `export?format=txt`, Sheets → `export?format=csv`).
- **Pré-condição:** os 3 documentos precisam estar compartilhados como **"qualquer pessoa com o link pode ver"**.
- Os dados ficam em cache em memória (TTL padrão de 60 min). Expirado o TTL, a recarga acontece em background; se o Google falhar, o cache antigo é mantido.
- `POST /refresh` força a recarga imediata (use após editar os documentos).
- **Polos por proximidade:** cada polo é associado a um município do IBGE (arquivo `src/data/municipios.json`, com coordenadas, gerado a partir de [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros), licença MIT). A distância entre cidades é calculada em linha reta, sem API externa. Quando a busca traz `bairro`, o bairro é localizado pelo OpenStreetMap ([Nominatim](https://nominatim.org/release-docs/latest/api/Search/), máx. 1 req/s) e cada polo pelo CEP ([AwesomeAPI](https://docs.awesomeapi.com.br/api-cep)). Os dois ficam em cache em memória. Se a consulta falhar, a resposta sai sem a ordenação por bairro. Polos cuja cidade não é reconhecida aparecem em `/health` → `cache.polosSemCoordenadas` e ficam fora do fallback. Corrija a grafia na planilha ou adicione um apelido em `src/services/geo.js`.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `API_KEY` | Chave exigida no header `x-api-key` em todas as rotas (exceto `/health`). Se vazia, a API fica aberta (apenas para dev local). |
| `CACHE_TTL_MINUTES` | Validade do cache (padrão `60`). |
| `PORT` | Porta (o Render define automaticamente). |

## Rodando localmente

```bash
npm install
API_KEY=teste npm start
curl -H 'x-api-key: teste' 'localhost:3000/polos?cidade=arapiraca'
npm test
```

## Endpoints

Todas as respostas seguem o formato `{ "ok": true|false, "data": ..., "meta": ... }` — sempre JSON, inclusive erros.

| Rota | Descrição | Exemplo |
|---|---|---|
| `GET /health` | Status + idade do cache (sem API key) | `/health` |
| `GET /polos` | Filtros: `uf`, `cidade` (busca parcial sem acentos), `cep` (prefixo), `megaPolo` (`true`/`false`). Se a cidade não tiver polo, retorna os das cidades mais próximas em km (`meta.fallback: true`, `distanciaKm`, `limite` = nº de cidades, padrão 5). Com `bairro` (opcional), ordena pela distância até o bairro | `/polos?uf=AL&cidade=quebrangulo` |
| `GET /cursos` | Lista cursos distintos; filtro `modalidade` | `/cursos?modalidade=graduacao` |
| `GET /cursos/grade` | Disciplinas em ordem + carga horária total. Obrigatório: `curso` (match fuzzy) | `/cursos/grade?curso=analise e desenvolvimento` |
| `GET /prerequisitos` | Todos os cursos de 2ª graduação com formações aceitas; filtro `curso` | `/prerequisitos?curso=engenharia civil` |
| `GET /prerequisitos/verificar` | Elegibilidade: `cursoDesejado` + `formacao` → `elegivel`, duração e formação que casou | `/prerequisitos/verificar?cursoDesejado=administracao&formacao=direito` |
| `GET /search` | Busca geral nos 3 conjuntos. Obrigatório: `q` | `/search?q=biomedicina` |
| `POST /refresh` | Força recarga dos 3 documentos | — |

## Deploy no Render

1. Suba este repositório no GitHub.
2. No Render: **New → Blueprint** e aponte para o repositório (o `render.yaml` configura tudo, incluindo `API_KEY` gerada automaticamente — copie o valor em *Environment*).
3. Plano **Free**: o serviço dorme após 15 min sem uso e a primeira requisição seguinte demora ~50 s (cold start). O cache é recarregado automaticamente ao acordar.

## Usando no n8n (nó HTTP Request)

- **Method:** `GET`
- **URL:** `https://SEU-SERVICO.onrender.com/prerequisitos/verificar`
- **Query Parameters:** `cursoDesejado` = `administracao`, `formacao` = `direito`
- **Headers:** `x-api-key` = valor da `API_KEY` do Render
- **Options → Timeout:** use 60000 ms ou mais por causa do cold start do plano Free.

Para o AI Agent do n8n, exponha cada endpoint como uma *tool* (HTTP Request Tool) descrevendo os parâmetros acima — o formato `{ ok, data, meta }` é estável e fácil de a IA interpretar.
