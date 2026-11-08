# J.S. — Julia Satorno

Aplicativo pessoal de organização: **Rotina**, **Treino**, **Alimentação** (com tabela nutricional e cardápio), **Cronograma capilar**, **Corpo** (bioimpedância), **Financeiro** e **Gráficos**, com painel inicial, agenda unificada, lembretes e backup.
Sem login: os dados ficam no próprio aparelho. O único servidor é opcional e serve só para os avisos chegarem com o app fechado (seção 4).

No celular, a barra de baixo tem **Início, Rotina, Treino, Alimentação e Mais** (Cronograma capilar, Financeiro, Corpo, Gráficos, Agenda e Configurações). Em tablet deitado ou computador, a barra vira uma coluna lateral com todos os módulos e as telas usam duas colunas.

Ele é um app web (PWA): abre no navegador e pode ser **instalado no celular pelo Chrome**, com ícone na tela inicial, abrindo em tela cheia e funcionando sem internet.

---

## 1. Abrir no computador

**Jeito mais simples:** dê dois cliques em `index.html`. Ele abre no navegador e já funciona, salvando os dados.

**Para testar a instalação e o modo offline no computador:** com o Node instalado, rode na pasta `aplicativo`:

```
node servidor.js
```

e abra http://localhost:5190. Se a porta estiver ocupada: `set PORT=8080 && node servidor.js`.

## 2. Instalar no celular

O Chrome só instala apps que estão em um endereço **https**. Por isso a pasta `aplicativo` precisa ser publicada uma vez em uma hospedagem gratuita:

- **GitHub Pages** (usado neste projeto): o repositório é a própria pasta `aplicativo`. Em *Settings → Pages*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**. O app fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
- **Netlify Drop** (alternativa): entre em https://app.netlify.com/drop, crie uma conta grátis e arraste a pasta `aplicativo` para a página. Você recebe um link `https://...netlify.app`.

No celular:

- **Android:** abra o link no **Chrome**, toque no menu **⋮** e escolha **Instalar app** (ou **Adicionar à tela inicial**). O J.S. também mostra um botão **Instalar** no painel quando o Chrome permite.
- **iPhone:** abra o link no **Safari**, toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.

### Publicar uma versão nova

Depois de alterar os arquivos, aumente o número em `sw.js` (`var VERSION = 'js-v2.2.0'`) e em `js/app.js`, faça o commit e envie (`git push`). O GitHub Pages atualiza em cerca de 1 minuto, e com internet o app sempre busca a versão mais recente.

## 3. Dados e backup — leia isto

- Os dados ficam **só no aparelho e no navegador onde foram cadastrados**. O que você cadastrar no computador não aparece no celular, e vice-versa.
- Limpar os dados do navegador, desinstalar o app ou perder o celular **apaga tudo**, a menos que exista um backup.
- Em **Configurações → Backup** dá para salvar um arquivo, enviá-lo por WhatsApp, e-mail ou Drive, e restaurá-lo em outro aparelho. O painel lembra de fazer backup a cada 14 dias.

## 3.1 Treino

- **Fichas:** monte fichas (ex.: "Treino A — Pernas") com exercícios da biblioteca (48 exercícios por grupo muscular, cada um com desenho animado da execução e dica) ou criados por você, com séries, repetições, carga e descanso.
- **Semana fixa e troca do dia:** em Treino → Semana, cada dia da semana recebe uma ficha (ou descanso). Para mudar só um dia (ex.: na terça treinar braço em vez de perna), use **Trocar** em Hoje ou toque no dia em **Mês**. As próximas semanas continuam iguais.
- **Calendário do mês:** mostra a ficha de cada dia (letra e cor), os treinos feitos (✓) e os descansos.
- **Execução:** "Iniciar treino" faz uma contagem 3-2-1 e abre o treino em tela cheia, com a tela sempre acesa. Ajuste a carga e as repetições com **+/−** e toque em **Série feita**. O descanso começa sozinho e avisa com bipe e vibração quando acaba. Ao terminar, aparece o resumo (duração, séries, volume e recordes) e a ficha passa a sugerir a última carga usada.
- **Toque atrás:** com o J.S. aberto no treino, **bata 2 vezes na parte de trás do celular** para abrir a **telinha do peso**: mostra o exercício atual com o peso e as repetições em botões grandes (+, −, +2,5 kg, +5 kg, ou digitar). "Registrar série" (ou bater 2 vezes de novo) salva a série com esse peso; "Só salvar o peso" muda a carga sem registrar. O descanso começa sozinho. Funciona no Android e no iPhone, pelo sensor de movimento. No iPhone o app pede permissão para usar o sensor. Em Configurações → Treino dá para mudar a sensibilidade e **testar e calibrar** com as suas batidas. Com o app fechado, nenhum site instalado consegue ouvir o sensor. Por isso, o toque atrás do próprio celular (Samsung Good Lock/RegiStar, Pixel "Toque rápido") pode ser configurado para **abrir o J.S.**, que vai direto para o treino em andamento.
- **Toque atrás em qualquer tela:** com o app aberto, as 2 batidas levam ao treino (e, em Treino → Hoje, iniciam o treino do dia); com treino em andamento, abrem a telinha do peso.
- **Abrir direto no treino:** como o toque atrás do celular só abre o app, o J.S. abre (sem a intro) na execução quando há treino em andamento, e em Treino → Hoje nos dias de treino ainda não feitos. Ajuste em Configurações → "Ao abrir o app" (dias de treino / sempre Treino / sempre Início).
- **Desenho da execução (sem internet):** cada um dos 48 exercícios tem um desenho animado próprio do app (`js/exanim.js` + `js/dados/animacoes.js`) mostrando o movimento, com o aparelho, barra ou halteres. Na lista de exercícios a miniatura mostra a posição inicial e a final; tocar abre o desenho animado ali mesmo, com a dica e o botão de escolher. No treino, "Como fazer" mostra o desenho animado. Exercício criado por você pode ter um link de vídeo seu.
- **Evolução:** para cada aparelho, um gráfico da carga máxima por treino e o volume, mostrando se a carga está aumentando ou diminuindo em relação ao treino anterior e ao primeiro.
- **Lembrete:** em Treino → Semana, escolha um horário para ser avisada nos dias que têm ficha.

## 3.2 Alimentação e Corpo

- **Diário:** registre o que comeu em cada refeição. Os nutrientes de cada alimento, de cada refeição e do dia vêm da **Tabela TACO** (Tabela Brasileira de Composição de Alimentos, 4ª edição, NEPA/UNICAMP), com 597 alimentos. A tabela completa tem energia, macronutrientes, fibras, sódio, colesterol, minerais e vitaminas. Valores que a TACO não analisou aparecem como "—", nunca como zero. Dá para salvar porções (ex.: "1 unidade = 50 g") e cadastrar alimentos que não estão na tabela.
- **Meta de calorias:** definida por você ou estimada automaticamente pelo metabolismo basal (da bioimpedância ou, sem ela, pela fórmula de Mifflin-St Jeor com peso, altura e idade) × nível de atividade.
- **Cardápio:** sugestões para as refeições do dia (as de Horários; sem horários, 4 refeições), montadas com alimentos da TACO e com as porções ajustadas à meta. Há "Outra opção" e "Usar no diário". São sugestões gerais e equilibradas, que não substituem a orientação de uma nutricionista.
- **Corpo:** registre os dados da balança de bioimpedância (peso, % de gordura, massa muscular, massa magra, água, gordura visceral, metabolismo basal, massa óssea, proteína, idade metabólica) e medidas com fita. O app mostra a diferença para a medição anterior, a **indicação de massa muscular** (ganhando, estável ou perdendo, % do peso e kg/m²), o IMC (faixas da OMS), a faixa de gordura (referência geral da ACE) e gráficos.
- **Imagens dos alimentos:** cada alimento aparece com uma imagem (ícone) no cardápio, no diário e na busca; o cartão de cada refeição sugerida mostra o "prato" com as imagens.
- **Gráficos:** painel em 30 dias, 90 dias ou 12 meses, com filtro por módulo (Treino, Corpo, Alimentação, Rotina, Finanças, Capilar):
  - números do período comparados com o período anterior, com minilinha de tendência;
  - **Destaques** em frases (ex.: "2 treinos a mais que no período anterior", "Massa muscular +0,5 kg");
  - **Constância** dos treinos num calendário de quadradinhos, com a sequência de semanas;
  - treinos e volume, **evolução das cargas** dos exercícios mais feitos, peso, massa muscular, gordura, calorias com a meta, macronutrientes, tarefas e taxa de conclusão, contas por mês e por categoria, tratamentos capilares.
  - Toque num gráfico para ver o valor; cada gráfico tem a tabela equivalente. Linhas e barras aparecem com animação (menos no modo "menos animação").
- **Tarefas:** além de concluir, dá para **Começar agora** (botão ▶ nas tarefas de hoje). A tarefa ganha uma animação de largada e fica "Em andamento" com cronômetro. Ao concluir, o app mostra quanto tempo levou. Para repetir em dias certos, marque os **dias da semana** escritos (Seg, Ter, Qua...) acima de Repetição: a tarefa repete toda semana nesses dias.

## 4. Notificações

- **Tudo com horário avisa por padrão:** ao pôr a hora numa tarefa, o lembrete vira "15 min antes"; num tratamento, "na hora". Refeições avisam na hora e contas 1 dia antes e no dia. Dá para mudar ou desligar em cada item. Itens antigos sem lembrete aparecem num aviso no painel e em Configurações, com o botão **Ligar todos**.
- O J.S. pede permissão na primeira vez que você cria um lembrete. Se você responder "Agora não", ele só volta a perguntar depois de 7 dias. Também dá para ativar em **Configurações**.
- **Sem o servidor**, os avisos aparecem enquanto o app está aberto ou em segundo plano. Ao abrir o app, os lembretes das últimas 2 horas aparecem, e as pendências atrasadas ficam no painel.
- **Com "Avisos com o app fechado" ligado** (Configurações → Notificações), os avisos chegam na hora **mesmo com o app fechado**. Ao permitir as notificações, o app oferece ligar isso uma vez.
- Funcionam melhor no Android com Chrome. No iPhone, só com o app instalado na tela de início (iOS 16.4 ou mais novo).
- Por privacidade, o valor das contas não aparece na notificação. Isso pode ser ligado em Configurações.

### Servidor de avisos (Web Push)

Segue a mesma base do push do Meu Financeiro IA (Supabase + biblioteca `web-push` + chaves VAPID guardadas no banco), sem o Render:

- **Função** `supabase/functions/js-push` (Supabase Edge Function), no projeto Supabase `jmjenkgmicqbftzndvrl`. O endereço está em `js/config.js`.
- **Envio:** o `pg_cron` chama a função **a cada minuto** e ela manda o que venceu (lembretes atrasados mais de 2 h não são mais enviados). Cada lembrete sai uma vez só.
- **Sem login:** cada aparelho gera um id e um segredo próprios. O servidor guarda só o hash do segredo, e as tabelas (`js_*`) são fechadas para acesso externo (RLS).
- **O que vai para o servidor:** só a inscrição de push do aparelho e os lembretes futuros (título, texto e horário):
  - **com data marcada** (tarefa, tratamento, conta): na data que for, até 2 anos à frente;
  - **que se repetem** (refeições, tarefas diárias/semanais/mensais): 90 dias à frente, renovados toda vez que o app abre. Se o app ficar mais de 90 dias sem ser aberto, os repetidos depois disso só voltam quando ele for aberto.
- **Envio econômico:** a lista inteira vai uma vez; depois, só o que mudou. Se a contagem do servidor não bater com a do app, ele reenvia tudo sozinho. O app sincroniza sempre que algo muda e ao abrir. Desligar apaga tudo do servidor. O segredo do aparelho não vai no backup.

Para publicar de novo, com a CLI do Supabase logada na conta dona do projeto, na pasta `aplicativo`:

```
supabase link --project-ref jmjenkgmicqbftzndvrl
supabase db query --linked -f supabase/sql/01_tabelas.sql              # tabelas (só na primeira vez)
supabase secrets set JS_CRON_SECRET=<valor-aleatório>                   # segredo do agendamento
supabase functions deploy js-push --no-verify-jwt --use-api            # função
# agendamento: troque SEU-PROJETO e SEU-SEGREDO em supabase/sql/02_agendamento.sql e rode com db query
```

## 5. Logo e intro

- **Logo:** monograma "J S" entrelaçado dentro de um anel fino, em tons de rosa. Os arquivos ficam em `../logo/`: SVG vetorial em várias versões (fundo rosa, arredondada, transparente, branca e a assinatura "J.S.") e PNG em 1024 px. As letras são da fonte Cormorant Garamond Italic (licença livre OFL), convertidas em desenho, então não dependem da fonte instalada. As opções que foram comparadas estão em `../logo/opcoes-logo.html`.
- **Intro:** baseada na intro do Meu Financeiro IA, com cerca de 5,5 s de carregamento.
  - Animação da logo: um disco rosa surge, o anel se desenha, o J e o S são "escritos" (o contorno é traçado e depois a cor preenche), um brilho atravessa a logo e estrelinhas piscam em volta. Anéis giram ao redor.
  - Frases de carregamento com barra de progresso.
  - Flores desenhadas (três tipos, em tons de rosa e lilás) flutuam no fundo e pulam embaixo da frase.
  - Interativa: tocar solta um monte de flores e uma flor grande desabrocha no ponto do toque (e estende um pouco a intro), a logo se inclina seguindo o dedo, e "Pular" ou Esc entra direto.
  - Volta a aparecer quando o app é reaberto depois de 5 minutos fora.
  - Pode ser desligada em **Configurações → Aplicativo**, onde também há o botão "Ver a intro agora".
- **Animações do app** (`js/anim.js`):
  - As telas deslizam na direção da aba e os cartões aparecem em cascata.
  - Ao concluir, o ✓ pula e se desenha e o título é riscado. Com tudo do dia feito, caem pétalas.
  - Itens novos entram com brilho e excluídos encolhem e saem.
  - Conta paga brilha em verde e os totais do mês contam até o valor.
  - Registrar autocuidado solta pétalas.
  - Folhas, confirmações e avisos entram e saem suavemente.
- **Menos animação:** se o aparelho estiver configurado para mostrar menos animações (no Windows: *Configurações → Acessibilidade → Efeitos visuais → Efeitos de animação*), a logo continua animada, mas sem os anéis girando e as pétalas flutuando, e no resto do app as animações viram só esmaecimentos suaves. Para ver a versão completa mesmo assim, ligue **Animações sempre ligadas** em Configurações.

## 6. Testes

As regras de negócio têm testes automáticos. `regras.test.js` cobre recorrência, centavos, contas recorrentes, lembretes e backup. `v2.test.js` cobre fichas, troca do dia, execução, evolução de carga, corpo, TACO, cardápio, tarefa em andamento e o reconhecimento do toque atrás com sinais simulados.

```
node --test testes/regras.test.js testes/v2.test.js
```

## 7. Estrutura

```
aplicativo/
├── index.html              página única do app
├── manifest.webmanifest    nome, cores e ícones para a instalação
├── sw.js                   funcionamento offline e toque nas notificações
├── servidor.js             servidor local para testes (opcional)
├── css/style.css           visual (paleta do design system em ../JS_Starter/docs)
├── css/v2.css              telas da versão 2 e layout para tablet/computador
├── icons/                  ícones do app gerados a partir da logo
├── js/
│   ├── intro.js            intro animada e interativa
│   ├── anim.js             animações do app (inclui contagem 3-2-1 e faíscas)
│   ├── core.js             datas, dinheiro em centavos, rótulos
│   ├── regras.js           regras de negócio de todos os módulos (testadas)
│   ├── regras-treino.js    fichas, semana, execução e evolução (testadas)
│   ├── regras-corpo.js     bioimpedância e indicações (testadas)
│   ├── regras-nutricao.js  TACO, diário, meta e cardápio (testadas)
│   ├── toque.js            reconhecimento das 2 batidas atrás do celular
│   ├── graficos.js         gráficos em SVG (sem bibliotecas)
│   ├── exanim.js           desenhos animados da execução dos exercícios
│   ├── dados/              biblioteca de exercícios, Tabela TACO e opções de cardápio
│   ├── store.js            armazenamento local, migração e backup
│   ├── notify.js           lembretes e permissão de notificação
│   ├── push.js             avisos com o app fechado (inscrição e sincronização com o servidor)
│   ├── config.js           endereço do servidor de avisos
│   ├── ui.js               componentes de tela
│   ├── app.js              navegação, instalação e inicialização
│   └── telas/              inicio, rotina, treino, sessao (execução), alimentacao, autocuidado (cronograma capilar),
│                           corpo, financeiro, graficos, mais, agenda, config
├── supabase/
│   ├── functions/js-push/  servidor de avisos (Edge Function)
│   └── sql/                tabelas e agendamento a cada minuto
└── testes/                 regras.test.js e v2.test.js
```

A especificação original está em `../JS_Starter/docs/`.

## 8. Fora desta versão

- Sincronização dos dados entre aparelhos (precisaria de armazenamento em nuvem e consentimento).
- Registrar série com o iPhone totalmente fechado (precisaria de um Atalho do iOS chamando o servidor de avisos, com uma fila de toques que o app aplica ao abrir).
