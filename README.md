# J.S. — Julia Satorno

Aplicativo pessoal de organização: **Rotina**, **Treino**, **Alimentação** (com tabela nutricional, cardápio e água), **Ciclo menstrual**, **Cronograma capilar**, **Corpo** (bioimpedância e fotos de evolução), **Financeiro** e **Gráficos**, com painel inicial, agenda unificada, busca geral, lembretes e backup.
Sem login: os dados ficam no próprio aparelho. O único servidor é opcional e serve só para os avisos chegarem com o app fechado (seção 4).

No celular, a barra de baixo tem **Início, Rotina, Treino, Alimentação e Mais** (Cronograma capilar, Financeiro, Ciclo menstrual, Corpo, Gráficos, Agenda e Configurações). A **lupa** no topo abre a busca geral: tarefas, contas, tratamentos, horários de refeição, fichas, exercícios, alimentos e qualquer tela ou ajuste do app. Em tablet deitado ou computador, a barra vira uma coluna lateral com todos os módulos e as telas usam duas colunas.

**Tamanho da tela:** o app se adapta sozinho a qualquer aparelho. No celular fica em 100%; em tablet, aumenta conforme o tamanho da tela (até 160%, igual em pé e deitado sempre que o layout permite); em computador com tela larga, aumenta um pouco (até 135%). Se o navegador do tablet estiver no modo "site para computador", que desenha a página com 980 px e encolhe tudo, o app compensa. Em Configurações → Aplicativo → **Tamanho da tela** dá para escolher na mão (90% a 150%) ou voltar ao automático. Por dentro: todo o CSS usa `rem`, e o `<head>` do `index.html` (`window.JS_FIT`) define quanto vale 1rem e recalcula quando a tela gira.

**Aparência:** títulos em Cormorant Garamond itálico e texto em Nunito (as duas guardadas em `fonts/`, funcionam sem internet), tons pastéis e detalhes florais. Em Configurações → **Aparência** dá para escolher o tema (Automático, que segue o celular, Claro ou **Escuro**, em tons de ameixa) e a paleta (**Rosé, Lavanda, Pêssego ou Nude**). Por dentro: todas as cores são variáveis CSS (`css/style.css`), e o `<head>` do `index.html` (`window.JS_THEME`) aplica o tema antes de desenhar a tela.

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

Depois de alterar os arquivos, aumente o número em `sw.js` (`var VERSION = 'js-v2.6.1'`) e em `js/app.js`, faça o commit e envie (`git push`). O GitHub Pages atualiza em cerca de 1 minuto, e com internet o app sempre busca a versão mais recente.

## 3. Dados e backup — leia isto

- Os dados ficam **só no aparelho e no navegador onde foram cadastrados**. O que você cadastrar no computador não aparece no celular, e vice-versa.
- Limpar os dados do navegador, desinstalar o app ou perder o celular **apaga tudo**, a menos que exista um backup.
- Em **Configurações → Backup** dá para salvar um arquivo, enviá-lo por WhatsApp, e-mail ou Drive, e restaurá-lo em outro aparelho. O painel lembra de fazer backup a cada 14 dias.
- As **fotos de evolução** ficam no próprio navegador (IndexedDB), nunca vão para servidor, e entram no arquivo de backup (o arquivo fica maior). Restaurar um backup sem fotos não apaga as fotos do aparelho.

## 3.1 Treino

- **Fichas:** monte fichas (ex.: "Treino A — Pernas") com exercícios da biblioteca (100 exercícios por grupo muscular, cada um com desenho animado da execução e dica) ou criados por você, com séries, repetições, carga e descanso.
- **Semana fixa e troca do dia:** em Treino → Semana, cada dia da semana recebe uma ficha (ou descanso). Para mudar só um dia (ex.: na terça treinar braço em vez de perna), use **Trocar** em Hoje ou toque no dia em **Mês**. As próximas semanas continuam iguais.
- **Calendário do mês:** mostra a ficha de cada dia (letra e cor), os treinos feitos (✓) e os descansos.
- **Séries por grupo muscular:** em Treino → Hoje, quantas séries cada grupo (quadríceps, glúteos, costas...) recebeu na semana, comparado com a semana passada, com a referência comum de 10 a 20 séries semanais por grupo.
- **Execução:** "Iniciar treino" faz uma contagem 3-2-1 e abre o treino em tela cheia, com a tela sempre acesa. Ajuste a carga e as repetições com **+/−** e toque em **Série feita**. O descanso começa sozinho e avisa com bipe e vibração quando acaba. Ao terminar, aparece o resumo (duração, séries, volume e recordes) e a ficha passa a sugerir a última carga usada.
- **Toque atrás:** com o J.S. aberto no treino, **bata 2 vezes na parte de trás do celular** para abrir a **telinha do peso**: mostra o exercício atual com o peso e as repetições em botões grandes (+, −, +2,5 kg, +5 kg, ou digitar). "Registrar série" (ou bater 2 vezes de novo) salva a série com esse peso; "Só salvar o peso" muda a carga sem registrar. O descanso começa sozinho. Funciona no Android e no iPhone, pelo sensor de movimento. No iPhone o app pede permissão para usar o sensor. Em Configurações → Treino dá para mudar a sensibilidade e **testar e calibrar** com as suas batidas. Com o app fechado, nenhum site instalado consegue ouvir o sensor. Por isso, o toque atrás do próprio celular (Samsung Good Lock/RegiStar, Pixel "Toque rápido") pode ser configurado para **abrir o J.S.**, que vai direto para o treino em andamento.
- **Toque atrás em qualquer tela:** com o app aberto, as 2 batidas levam ao treino (e, em Treino → Hoje, iniciam o treino do dia); com treino em andamento, abrem a telinha do peso.
- **Ao abrir o app:** pelo ícone, o J.S. abre como sempre, com a intro e no Início. Com **treino em andamento**, abre direto na execução do treino, sem a intro. Em Configurações → "Ao abrir o app" dá para escolher abrir no Treino nos dias de treino (útil para quem usa o toque atrás do celular, que só consegue abrir o app) ou sempre no Treino.
  - **Treino em andamento sempre ganha:** depois de iniciar o treino (pelo botão, pelo toque atrás ou pelo registro rápido), abrir ou voltar para o app leva à execução do treino, mesmo que o ícone tenha outra aba no endereço. Vale para treino do dia ou com série nas últimas 6 horas (um treino esquecido de ontem não prende a abertura). Recarregar a página mantém a aba que estava aberta.
  - **Séries do atalho do iPhone:** quando o app importa as séries salvas pela página do atalho, ele vai para o treino em andamento (e fecha a intro, se estiver passando).
- **Treinos prontos:** em Treino → Fichas (ou na tela vazia), "Treinos prontos" traz 20 fichas (academia, em casa, cardio e abdômen) e 7 semanas completas (ABC, ABCD, ABCDE, foco em glúteos e pernas, full body, adaptação e em casa). Cada ficha mostra os exercícios com o desenho, séries, repetições e descanso; "Adicionar ficha" cria uma ficha normal, que dá para editar. "Usar esta semana" cria as fichas e monta a semana fixa (os outros dias ficam de descanso; pergunta antes de trocar uma semana já montada); "Só adicionar as fichas" não mexe na semana. Ficha com o mesmo nome não é duplicada, e a carga de cada exercício começa com a última que você usou. Os treinos ficam em `js/dados/treinos.js`.
- **Desenho da execução (sem internet):** cada um dos 100 exercícios tem um desenho animado próprio do app (`js/exanim.js` + `js/dados/animacoes.js`) mostrando o movimento, com o aparelho, barra ou halteres. Na lista de exercícios a miniatura mostra a posição inicial e a final; tocar abre o desenho animado ali mesmo, com a dica e o botão de escolher. No treino, "Como fazer" mostra o desenho animado. Exercício criado por você pode ter um link de vídeo seu.
- **Evolução:** para cada aparelho, um gráfico da carga máxima por treino e o volume, mostrando se a carga está aumentando ou diminuindo em relação ao treino anterior e ao primeiro.
- **Lembrete:** em Treino → Semana, escolha um horário para ser avisada nos dias que têm ficha.

## 3.1.1 Registro rápido do treino

Telinha compacta para salvar uma série sem navegar: **exercício** (já vem o do treino em andamento), **peso utilizado**, **repetições**, **série**, **Salvar série** e **Fechar**. Peso e repetições vêm preenchidos com o que foi usado da última vez (ou com a carga planejada daquela série na ficha), com botões grandes de + e − e atalhos de ±2,5 e ±5 kg. Mostra a última série e a maior carga do exercício.

- **Sem treino em andamento:** a telinha sugere os exercícios da ficha do dia (ou os feitos recentemente) e o treino começa ao salvar. "Outro exercício…" abre a lista completa.
- **Série com número que já existe:** corrige aquela série (ex.: série 1 era 60 kg, não 62,5).
- **Exercício que não estava no treino:** entra no treino.
- **Histórico** (Treino → Evolução): última série, maior carga, gráfico da carga e o histórico de séries de cada treino (S1 60×10, S2 65×8…), marcando as que vieram do atalho do iPhone (⌁) e do toque atrás (·).

Como abrir:
- **No app:** botão "Registro rápido de uma série" em Treino → Hoje; 2 batidas atrás do celular (sensor) em qualquer tela — com treino em andamento, 2 batidas de novo salvam; ao voltar para o app durante o treino (opção em Configurações).
- **Android:** segure o ícone do J.S. → **Registro rápido** (dá para arrastar para a tela inicial). O toque atrás do próprio celular (Pixel "Toque rápido", Samsung Good Lock/RegiStar) configurado para **abrir o J.S.** cai direto no registro durante o treino.
- **iPhone (Tocar Atrás):** em Configurações → Registro rápido do treino → **Criar meu link do atalho**. Depois:
  1. Copie o link.
  2. App **Atalhos** → **+** → **Adicionar Ação** → **Abrir URLs** → cole o link. Nome: **Registrar treino no J.S.**
  3. **Ajustes → Acessibilidade → Toque → Tocar Atrás → Toque Duplo** → escolha **Registrar treino no J.S.**
  4. Dois toques atrás do iPhone abrem a página do registro rápido (`rapido.html`), já com o exercício atual. Ao salvar, a série vai para o servidor; quando o J.S. abre, ela entra no treino (e sai do servidor).

Limitações dos sistemas: o J.S. é um app web instalado (PWA). Ele não consegue detectar o Tocar Atrás diretamente nem ter App Intents, widgets ou blocos de Configurações rápidas, que só existem em apps nativos. No iPhone, a página aberta pelo Atalho fica no Safari, que não enxerga os dados do app instalado; por isso ela usa o servidor. A página precisa de internet.

## 3.2 Alimentação e Corpo

- **Água:** no Diário, um copo que enche, gotinhas e os últimos 7 dias. Botões "+1 copo" (do tamanho que você digitar, de 30 ml a 2 L), "+500 ml" e "Outra", com desfazer. A meta é automática (35 ml por kg do último peso, entre 1,5 e 4 L; sem peso, 2 L) ou definida por você. **Lembretes de água** opcionais (de 1 em 1 h até 4 em 4 h, no horário escolhido): param quando você bate a meta do dia, e o aviso de um horário pula se você bebeu há pouco. No Início há o cartão "Água hoje" e o botão **Água** em Adicionar soma um copo.
- **Repetir refeição:** num dia vazio, o Diário oferece "Repetir o dia de ontem" (ou do último dia com alimentos, até 14 dias). Com o dia começado, cada refeição vazia mostra "Repetir de ontem" com os alimentos daquela refeição. Sempre com desfazer.
- **Favoritos e recentes:** a estrela ☆ na tabela nutricional de um alimento o deixa nos favoritos. Ao adicionar um alimento, aparecem primeiro os favoritos e depois os usados recentemente, já com a última quantidade.
- **Diário:** registre o que comeu em cada refeição. Os nutrientes de cada alimento, de cada refeição e do dia vêm da **Tabela TACO** (Tabela Brasileira de Composição de Alimentos, 4ª edição, NEPA/UNICAMP), com 597 alimentos. A tabela completa tem energia, macronutrientes, fibras, sódio, colesterol, minerais e vitaminas. Valores que a TACO não analisou aparecem como "—", nunca como zero. Dá para salvar porções (ex.: "1 unidade = 50 g") e cadastrar alimentos que não estão na tabela.
- **Meta de calorias:** definida por você ou estimada automaticamente pelo metabolismo basal (da bioimpedância ou, sem ela, pela fórmula de Mifflin-St Jeor com peso, altura e idade) × nível de atividade.
- **Cardápio:** sugestões para as refeições do dia (as de Horários; sem horários, 4 refeições), montadas com alimentos da TACO e com as porções ajustadas à meta. Há "Outra opção" e "Usar no diário". São sugestões gerais e equilibradas, que não substituem a orientação de uma nutricionista.
- **Corpo:** registre os dados da balança de bioimpedância (peso, % de gordura, massa muscular, massa magra, água, gordura visceral, metabolismo basal, massa óssea, proteína, idade metabólica) e medidas com fita. O app mostra a diferença para a medição anterior, a **indicação de massa muscular** (ganhando, estável ou perdendo, % do peso e kg/m²), o IMC (faixas da OMS), a faixa de gordura (referência geral da ACE) e gráficos.
- **Fotos de evolução (Corpo):** adicione fotos (frente, lado, costas), que são reduzidas para até 1600 px. Elas aparecem desfocadas até você tocar em Mostrar. **Antes e depois:** escolha duas fotos e deslize a divisória (ou veja lado a lado), com os dias entre elas e a diferença de peso.
- **Imagens dos alimentos:** cada alimento aparece com uma imagem (ícone) no cardápio, no diário e na busca; o cartão de cada refeição sugerida mostra o "prato" com as imagens.
- **Gráficos:** painel em 30 dias, 90 dias ou 12 meses, com filtro por módulo (Treino, Corpo, Alimentação, Rotina, Finanças, Capilar):
  - números do período comparados com o período anterior, com minilinha de tendência;
  - **Destaques** em frases (ex.: "2 treinos a mais que no período anterior", "Massa muscular +0,5 kg");
  - **Constância** dos treinos num calendário de quadradinhos, com a sequência de semanas;
  - treinos e volume, **evolução das cargas** dos exercícios mais feitos, peso, massa muscular, gordura, calorias com a meta, macronutrientes, tarefas e taxa de conclusão, contas por mês e por categoria, tratamentos capilares.
  - Toque num gráfico para ver o valor; cada gráfico tem a tabela equivalente. Linhas e barras aparecem com animação (menos no modo "menos animação").
- **Tarefas:** além de concluir, dá para **Começar agora** (botão ▶ nas tarefas de hoje). A tarefa ganha uma animação de largada e fica "Em andamento" com cronômetro. Ao concluir, o app mostra quanto tempo levou. Para repetir em dias certos, marque os **dias da semana** escritos (Seg, Ter, Qua...) acima de Repetição: a tarefa repete toda semana nesses dias.

## 3.3 Ciclo menstrual

- Registre o 1º dia da menstruação ("Minha menstruação começou") e, se quiser, o último ("terminou"). O J.S. calcula a média dos seus ciclos (dos últimos 6; até ter 2, usa a média que você informou), a **fase de cada dia** (menstrual, folicular, ovulatória, lútea), a **próxima menstruação**, o **período fértil estimado** e avisa quando está atrasada.
- **Como você está:** fluxo, energia, humor, sintomas e uma anotação para cada dia (dá para voltar a dias anteriores). Marcar fluxo num dia sem menstruação registrada começa uma.
- **Treino e energia:** em Treino → Hoje aparece a fase do dia com uma dica de treino e a pergunta "Como está sua energia hoje?". Na tela do Ciclo, o quadro **Energia e treino por fase** mostra a energia média, os sintomas mais comuns, os treinos por semana e o volume médio em cada fase.
- Calendário do mês com menstruação registrada e prevista, período fértil, ovulação e registros; histórico dos ciclos. Aviso opcional 2 dias antes da menstruação prevista.
- São estimativas pela média (fase lútea de cerca de 14 dias): **não servem como método anticoncepcional** nem substituem a orientação médica. Os dados ficam só no aparelho.

## 4. Notificações

- **Tudo com horário avisa por padrão:** ao pôr a hora numa tarefa, o lembrete vira "15 min antes"; num tratamento, "na hora". Refeições avisam na hora e contas 1 dia antes e no dia. Dá para mudar ou desligar em cada item. Itens antigos sem lembrete aparecem num aviso no painel e em Configurações, com o botão **Ligar todos**.
- O J.S. pede permissão na primeira vez que você cria um lembrete. Se você responder "Agora não", ele só volta a perguntar depois de 7 dias. Também dá para ativar em **Configurações**.
- **Sem o servidor**, os avisos aparecem enquanto o app está aberto ou em segundo plano. Ao abrir o app, os lembretes das últimas 2 horas aparecem, e as pendências atrasadas ficam no painel.
- **Com "Avisos com o app fechado" ligado** (Configurações → Notificações), os avisos chegam na hora **mesmo com o app fechado**. Ao permitir as notificações, o app oferece ligar isso uma vez.
- Funcionam melhor no Android com Chrome. No iPhone, só com o app instalado na tela de início (iOS 16.4 ou mais novo).
- Por privacidade, o valor das contas não aparece na notificação. Isso pode ser ligado em Configurações.
- **Água** e **Ciclo** também avisam (ligue os lembretes de água em Alimentação → Água). Para o servidor, vão os lembretes de água dos próximos 14 dias, renovados ao abrir o app.

### Servidor de avisos (Web Push) e do registro rápido

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
supabase db query --linked -f supabase/sql/03_registro_rapido.sql      # registro rápido do iPhone (só na primeira vez)
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

As regras de negócio têm testes automáticos. `regras.test.js` cobre recorrência, centavos, contas recorrentes, lembretes e backup. `v2.test.js` cobre fichas, troca do dia, execução, evolução de carga, corpo, TACO, cardápio, tarefa em andamento, o reconhecimento do toque atrás com sinais simulados, os treinos prontos e os desenhos de todos os exercícios. `v26.test.js` cobre água (meta, lembretes inteligentes), ciclo menstrual (médias, fases, previsões, atraso, registros), séries por grupo muscular, favoritos e repetir refeição.

```
node --test testes/regras.test.js testes/v2.test.js testes/v26.test.js
```

## 7. Estrutura

```
aplicativo/
├── index.html              página única do app
├── manifest.webmanifest    nome, cores e ícones para a instalação
├── sw.js                   funcionamento offline e toque nas notificações
├── servidor.js             servidor local para testes (opcional)
├── rapido.html             página do registro rápido aberta pelo atalho do iPhone
├── css/style.css           visual (paleta do design system em ../JS_Starter/docs)
├── css/v2.css              telas da versão 2 e layout para tablet/computador
├── css/v26.css             água, ciclo, fotos, busca e as outras novidades da 2.6
├── fonts/                  Nunito e Cormorant Garamond (licença OFL)
├── icons/                  ícones do app gerados a partir da logo
├── js/
│   ├── intro.js            intro animada e interativa
│   ├── anim.js             animações do app (inclui contagem 3-2-1 e faíscas)
│   ├── core.js             datas, dinheiro em centavos, rótulos
│   ├── regras.js           regras de negócio de todos os módulos (testadas)
│   ├── regras-treino.js    fichas, semana, execução e evolução (testadas)
│   ├── regras-corpo.js     bioimpedância e indicações (testadas)
│   ├── regras-nutricao.js  TACO, diário, meta, cardápio, favoritos e repetir refeição (testadas)
│   ├── regras-ciclo.js     ciclo menstrual: médias, fases, previsões, energia por fase (testadas)
│   ├── fotos.js            fotos de evolução (IndexedDB, redução, backup)
│   ├── toque.js            reconhecimento das 2 batidas atrás do celular
│   ├── graficos.js         gráficos em SVG (sem bibliotecas)
│   ├── exanim.js           desenhos animados da execução dos exercícios
│   ├── registro.js         registro rápido do treino (telinha, atalho do iPhone, importação)
│   ├── dados/              biblioteca de exercícios, desenhos, treinos prontos, Tabela TACO e opções de cardápio
│   ├── store.js            armazenamento local, migração e backup
│   ├── notify.js           lembretes e permissão de notificação
│   ├── push.js             avisos com o app fechado (inscrição e sincronização com o servidor)
│   ├── config.js           endereço do servidor de avisos
│   ├── ui.js               componentes de tela
│   ├── app.js              navegação, instalação e inicialização
│   └── telas/              inicio, rotina, treino, sessao (execução), alimentacao, autocuidado (cronograma capilar),
│                           corpo, ciclo, busca (busca geral), financeiro, graficos, mais, agenda, config
├── supabase/
│   ├── functions/js-push/  servidor de avisos (Edge Function)
│   └── sql/                tabelas e agendamento a cada minuto
└── testes/                 regras.test.js, v2.test.js e v26.test.js
```

A especificação original está em `../JS_Starter/docs/`.

## 8. Fora desta versão

- Sincronização dos dados entre aparelhos (precisaria de armazenamento em nuvem e consentimento).
- Registrar série com o iPhone totalmente fechado (precisaria de um Atalho do iOS chamando o servidor de avisos, com uma fila de toques que o app aplica ao abrir).
