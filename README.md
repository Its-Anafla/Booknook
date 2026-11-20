# Booknook — Reading Tracker (Entrega 1, front-end)

Biblioteca pessoal, lista de desejos e registro de leitura. HTML + CSS + JavaScript puros (ES modules), sem frameworks, sem backend.

## Membros da equipe
- Ana Flávia Peixoto, Giovane Cabral, Rafael Csizmar e Raphael Donizette

## Organização
```
index.html            só estrutura (sem style/onclick inline, sem <style>)
css/                  tokens, base, layout, components, shelf, views
data/seed.json        dados iniciais
js/store.js           TODO o acesso a dados (async, mesmos formatos do seed, erros 400/404/409)
js/validation.js      regras da Seção 4 (usadas nos formulários e de novo no store)
js/strings.js         todos os textos da interface e valores controlados, em um só lugar
assets/               fotos das decorações da estante (WebP com fundo transparente)
js/prefs.js           preferências visuais (ordem da estante, decoração, capas, cores) — fora do modelo de dados
js/model.js, utils.js, decor.js, icons.js
js/ui/                renderização: shelf, bookForm, readingForm, bookDetail, authors, wishlist, log, stats, graveyard, customize...
js/main.js            rotas (#/shelf, #/wishlist, #/log, #/authors, #/stats, #/graveyard)
```
Na Entrega 2, só `js/store.js` precisa ser reescrito para chamar a API.

## Checklist de requisitos
| ID | Requisito | Status |
|----|-----------|--------|
| FR-01 | Autores: criar, ver, editar, excluir; autor com livros não é excluído (409 com os títulos) | Implementado |
| FR-02 | Livros: CRUD, autores/temas escolhidos dos existentes, novo tema na hora (+ "+ New Author" na hora) | Implementado |
| FR-03 | Leituras: adicionar/editar/excluir; primeira leitura no formulário do livro; excluir livro informa quantas leituras serão apagadas | Implementado |
| FR-04 | Fluxo de status (ano obrigatório em Read, prioridade limpa ao sair de Want to read, limpar ano/nota com confirmação) | Implementado |
| FR-05 | Registro de leitura ordenável por coluna, "-" sempre no fim, padrão ano desc + ID asc | Implementado |
| FR-06 | Validação com mensagem junto ao campo; dado inválido nunca é salvo | Implementado |
| FR-07 | Seed no primeiro uso, mudanças persistem, Reset data com confirmação | Implementado |
| FR-08 | Filtros combinados + busca parcial (na estante e no registro) | Tentado — implementado |
| FR-09 | Wishlist por prioridade com "recomendado por" | Tentado — implementado |
| FR-12 | Estatísticas | Parcial: livros por ano, média geral, top 10. Faltam médias por ano/nacionalidade/forma |
| FR-13 | Gráficos | Parcial: gráfico de barras por ano e por mês (SVG próprio) + grade ano × mês |
| FR-10, 11, 14, 15 | — | Não tentado |

Extras: estante personalizável (fundo, madeira, paletas de lombada, cor por livro, luzes, 12 decorações em `assets/`: plantas, velas, bustos, globo, ampulheta, baú), arrastar e soltar com persistência, coleções com faixa, modo capas/lombadas, cemitério de abandonados com epitáfio e animação.

## Decisões e pontos de atenção
- **Campo extra `monthRead`** (opcional, 1–12, só com status Read) em cada leitura, usado pelo gráfico por mês. O seed do professor não tem mês; leituras sem mês aparecem em "No month". Se o professor exigir formato idêntico ao seed, remova o campo do select "Month read" em `readingFields.js`.
- **Título único**: pedido da equipe (a Seção 4 não exige). A checagem só roda quando o título é novo ou foi editado.
- **Novas decorações**: coloque a imagem (PNG/WebP com fundo transparente) em `assets/` e adicione uma linha em `DECOR_TYPES` (`js/decor.js`) com nome, arquivo e tamanho.
- **Epitáfio** do cemitério é salvo no campo `notes` da leitura.
- **Capa, cor da lombada, coleção, ordem da estante e decoração** ficam em `localStorage` sob a chave `rtui.prefs` (`js/prefs.js`), não no `seed.json`. Na Entrega 2 isso precisa virar colunas/endpoints ou continuar como preferência local — confirme com o professor, pois a Seção 6 fala em não usar `localStorage` para dados da aplicação na Entrega 2.
- Reordenar com toque: segure o livro por ~0,3 s e arraste. Teclado: foque o livro e use Alt + setas.

## Declaração de uso de IA
| Ferramenta | Utilizada para | Partes afetadas |
|------------|----------------|-----------------|
| **Gemini** | Depuração de erros de estilização. | Arquivo CSS 
(`css/`) | 
| **Claude** | Revisão de código e auditoria de conformidade (verificação de requesitos obrigatórios e restrições do PDF) | Estrutura geral do código (`index.html`, `css/`, `js/`) |
