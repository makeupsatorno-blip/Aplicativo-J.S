# J.S. — Julia Satorno

Aplicativo pessoal de organização (versão 2.8: Jardim, Resumo semanal, sono, skincare, cardápio da semana, relatório em PDF, backup automático e mais): **Rotina**, **Treino**, **Alimentação** (com tabela nutricional, cardápio e água), **Ciclo menstrual**, **Cronograma capilar**, **Corpo** (bioimpedância e fotos de evolução), **Financeiro** e **Gráficos**, com painel inicial, agenda unificada, busca geral, lembretes e backup.
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

Depois de alterar os arquivos, aumente o número em `sw.js` (`var VERSION = 'js-v2.8.1'`) e em `js/app.js`, faça o commit e envie (`git push`). O GitHub Pages atualiza em cerca de 1 minuto, e com internet o app sempre busca a versão mais recente.

## 3. Dados e backup — leia isto

- Os dados ficam **só no aparelho e no navegador onde foram cadastrados**. O que você cadastrar no computador não aparece no celular, e vice-versa.
- Limpar os dados do navegador, desinstalar o app ou perder o celular **apaga tudo**, a menos que exista um backup.
- Em **Configurações → Backup** dá para salvar um arquivo, enviá-lo por WhatsApp, e-mail ou Drive, e restaurá-lo em outro aparelho. O painel lembra de fazer backup a cada 14 dias.
- **Passar para outro aparelho** (Configurações; e no Início quando o app está vazio): o aparelho antigo gera um **código de 12 caracteres**; no novo, abra o J.S. pelo ícone e digite o código. Vai tudo, inclusive os treinos feitos e, se quiser, as fotos. Os dados são comprimidos e **cifrados no aparelho** com uma chave tirada do código (o código não vai para o servidor); a função `js-push` guarda só o conteúdo cifrado, por até 30 minutos, e apaga quando o outro aparelho recebe. Para ligar: publicar `supabase/sql/04_transferencia.sql` e a função, e pôr `transfer: true` em `js/config.js`.
- As **fotos de evolução** ficam no próprio navegador (IndexedDB), nunca vão para servidor, e entram no arquivo de backup (o arquivo fica maior). Restaurar um backup sem fotos não apaga as fotos do aparelho.

## 3.1 Treino

- **Fichas:** monte fichas (ex.: "Treino A — Pernas") com exercícios da biblioteca (100 exercícios por grupo muscular, cada um com desenho animado da execução e dica) ou criados por você, com séries, repetições, carga e descanso.
- **Semana fixa e troca do dia:** em Treino → Semana, cada dia da semana recebe uma ficha (ou descanso). Para mudar só um dia (ex.: na terça treinar braço em vez de perna), use **Trocar** em Hoje ou toque no dia em **Mês**. As próximas semanas continuam iguais.
- **Calendário do mês:** mostra a ficha de cada dia (letra e cor), os treinos feitos (✓) e os descansos.
- **Recordes pessoais:** o app compara cada série com todo o seu histórico do exercício. **Recorde de carga** = mais pesada do que qualquer série anterior; **recorde de repetições** = mais repetições do que já fez com a mesma carga. A primeira vez que você faz um exercício não conta. Na execução do treino aparece **"Seu recorde: 47 kg × 8"**, e a série que bate o recorde ganha troféu, um aviso grande ("Novo recorde!") e vibração; o registro rápido e o toque atrás também avisam. O resumo do treino destaca os recordes numa caixa, **Treino → Hoje** tem o cartão **Recordes pessoais** (últimos 30 dias), e **Evolução** marca as séries recordistas. Tudo é calculado do histórico: excluir um treino refaz os recordes.
- **Sugestão de carga:** na execução do treino, o chip **"Sugestão de hoje"** usa o último treino concluído do exercício e a faixa de repetições da ficha (ex.: 8-10). Se você fez todas as séries com o máximo da faixa, sugere **subir** um passo (2,5 kg com o passo padrão e carga a partir de 20 kg). Se ainda não bateu o máximo, sugere **manter** e tentar mais 1 repetição. Se ficou abaixo do mínimo duas vezes seguidas na mesma carga, sugere **reduzir** cerca de 7,5%. Em exercício de peso do corpo, sugere uma repetição a mais. Nada muda sozinho: toque em **Usar** (ou em **Ignorar**). A ficha mostra "↑ 42,5 kg" nos exercícios que podem subir. Dá para desligar em Configurações → Sugestões de carga.
- **Compartilhar recorde:** botão **Compartilhar** em cada recorde (resumo do treino, "Ver séries" e Recordes pessoais) gera um cartão bonito para enviar ou postar (veja Cartões para compartilhar).
- **Séries por grupo muscular:** em Treino → Hoje, quantas séries cada grupo (quadríceps, glúteos, costas...) recebeu na semana, comparado com a semana passada, com a referência comum de 10 a 20 séries semanais por grupo.
- **Execução:** "Iniciar treino" faz uma contagem 3-2-1 e abre o treino em tela cheia, com a tela sempre acesa. Ajuste a carga e as repetições com **+/−** e toque em **Série feita**. O descanso começa sozinho e avisa com bipe e vibração quando acaba. Ao terminar, aparece o resumo (duração, séries, volume e recordes) e a ficha passa a sugerir a última carga usada.
- **Toque atrás:** com o J.S. aberto no treino, **bata 2 vezes na parte de trás do celular** para abrir a **telinha do peso**: mostra o exercício atual com o peso e as repetições em botões grandes (+, −, +2,5 kg, +5 kg, ou digitar). "Registrar série" (ou bater 2 vezes de novo) salva a série com esse peso; "Só salvar o peso" muda a carga sem registrar. O descanso começa sozinho. Funciona no Android e no iPhone, pelo sensor de movimento. No iPhone o app pede permissão para usar o sensor. Em Configurações → Treino dá para mudar a sensibilidade e **testar e calibrar** com as suas batidas. Com o app fechado, nenhum site instalado consegue ouvir o sensor. Por isso, o toque atrás do próprio celular (Samsung Good Lock/RegiStar, Pixel "Toque rápido") pode ser configurado para **abrir o J.S.**, que vai direto para o treino em andamento.
- **Toque atrás no iPhone:** o iPhone só libera o sensor de movimento com um toque da usuária. Na primeira vez, o Início e o Treino mostram **"Ative o toque atrás neste iPhone" → Ativar agora** (também em Configurações → Treino: toque atrás). Depois disso, toda vez que o app abre, o **primeiro toque em qualquer lugar da tela religa o toque atrás sozinho**, sem perguntar de novo. O "Tocar Atrás" dos Ajustes do iPhone (que funciona com o app fechado) nenhum app consegue ligar sozinho: ele é configurado com o Atalho do Registro rápido (abaixo).
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
- **Meta de proteína e macros por refeição:** o Diário tem o cartão **Proteína** com o total do dia, a meta, quanto falta e quanto veio de cada refeição, e cada refeição mostra seus **P / C / G** (proteínas, carboidratos e gorduras em gramas). A meta é a que você definir (Alimentação → Meta, ou Configurações) ou automática: **gramas por kg do seu último peso** (padrão 1,6 g/kg; dá para escolher de 1,2 a 2,0). Sem peso nem meta, o cartão pede para definir. É referência geral, não prescrição: se uma nutricionista passou metas, use as dela. O Início também mostra a proteína no cartão de calorias.
- **Refeições salvas (aba Salvas):** monte uma vez refeições que você repete (ex.: "Meu café da manhã") e adicione com **um toque**. Para criar: toque no marcador de uma refeição do Diário (salva o que já está nela), ou em Alimentação → Salvas → **Nova refeição salva** (nome, refeição, alimentos e quantidades). Depois aparecem no atalho da refeição vazia do Diário, no topo de **Adicionar alimento** (as do mesmo tipo primeiro) e na aba Salvas, com desfazer. Dá para editar quantidades, trocar alimentos e excluir; entram no backup e na passagem para outro aparelho. Até 40 refeições, com até 30 alimentos cada.
- **Cardápio da semana e lista de compras (Mais → Cardápio da semana, ou "Planejar a semana" na aba Salvas):** monte a semana (segunda a domingo) escolhendo, em cada refeição de cada dia, uma das suas refeições salvas. Cada dia mostra kcal e proteína contra as metas. Dá para copiar um dia para outros, repetir a semana passada, **sugerir** (preenche só o que está vazio, em rodízio) e **aplicar o dia ou a semana ao Diário** (pergunta antes de duplicar). A aba **Lista de compras** soma os alimentos planejados (gramas por alimento, agrupados pelo grupo da TACO, com "≈ 6 unidades" quando há porção salva), com itens marcáveis, itens extras e botão para compartilhar ou copiar a lista.
- **Código de barras:** em "Adicionar alimento" e na aba Tabela, **Ler código de barras**. No Android/Chrome, a câmera lê o código; no iPhone (o Safari não tem leitor), digite os números abaixo do código (o app confere o dígito verificador). O app consulta o **Open Food Facts**, um serviço público: o número do código é enviado a ele, e mais nada. O produto vira um alimento seu (valores por 100 g, porção do rótulo) e vai para o Diário; produtos já cadastrados não consultam de novo. Sem internet, faltando dados ou produto desconhecido, dá para cadastrar à mão com o código anexado.
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

## 3.4 Bem-estar: sono, skincare, Jardim e Resumo

- **Sono (Corpo):** registre quanto dormiu (em horas, ou "dormi às / acordei às", com qualidade de 1 a 5). O cartão mostra a noite passada, a média dos 7 dias, a meta (padrão 8 h, de 4 a 12 h), a dívida de sono da semana em tom gentil e, com dados suficientes, a energia média nas noites em que a meta foi batida contra as outras. É referência geral, não orientação médica, e a relação não prova causa.
- **Skincare (Cronograma capilar):** passos de manhã e de noite (sugeridos e editáveis), marcação com um toque, sequência de dias e lembretes opcionais por período (o período já feito não avisa; interruptor em Configurações → Notificações). O cartão **Bem-estar** do Início aparece só para quem usa sono ou skincare.
- **Jardim da Julia (Início):** um cartão com as flores das últimas duas semanas, nascidas dos seus hábitos do dia (treino, meta de água, meta de proteína, tarefas, skincare e sono). Só contam os hábitos que você usa; dia sem hábito não conta nem quebra a sequência, e hoje ainda aberto nunca quebra. Toque para abrir o jardim de 12 semanas, ver os hábitos de cada dia e as conquistas (primeiro recorde, 7 dias de água, semanas floridas, sequência de 30 dias…). Dá para esconder em Configurações. Sem cobrança: semana fraca recebe uma frase acolhedora.
- **Resumo da semana (Mais):** balanço de domingo a sábado com um texto carinhoso (o mesmo toda vez que você abre a mesma semana), treinos, recordes, alimentação, água, peso, tarefas, sono, skincare, ciclo e o jardim da semana, só do que foi registrado; dá para navegar pelas semanas. No domingo e na segunda o Início mostra "Seu resumo da semana está pronto".
- **Cartões para compartilhar:** imagens feitas no próprio aparelho (retrato 1080×1350 ou Stories 1080×1920) para recordes, o resumo, o jardim e as conquistas, com Compartilhar e Salvar imagem. Não levam peso, medidas, fotos, sono nem ciclo; o primeiro nome só entra se você marcar.
- **Treino pelo ciclo (Ciclo):** o cartão mostra os próximos 7 dias com a fase de cada um e a ficha planejada, e "O que seus dados mostram": energia mais baixa ou mais alta por fase, a fase em que vêm mais recordes, frequência de treino e sintomas recorrentes. As frases só aparecem com dados suficientes (6 ou mais registros de energia na fase, 3 ou mais recordes). Em Treino → Hoje, o cartão da fase mostra a energia média daquela fase. Referência geral, não prescrição.

## 3.5 Ferramentas: escrever ou falar, PDF e calendário

- **Escrever ou falar o que fez (lupa do topo):** digite, por exemplo, "tarefa ligar para a mãe amanhã às 15h", "bebi 300 ml", "peso 62,4", "comi 2 ovos no café da manhã" ou "conta de luz 150 reais dia 28". O J.S. mostra um cartão **Entendi: …** e só cria quando você toca em **Criar** (com desfazer); **Editar** abre o formulário já preenchido. Tudo é interpretado no aparelho, sem IA e sem rede. Onde o navegador tem reconhecimento de voz, aparece um **microfone** (no iPhone, use o microfone do teclado).
- **Relatório em PDF (Configurações):** escolha o período (este mês, mês passado, últimos 30 dias ou personalizado) e as seções (Treino, Alimentação, Medidas, Água; Ciclo e Fotos vêm desligados por serem sensíveis). O PDF é gerado no aparelho, com tabelas, gráficos de carga e as fotos de antes e depois se você quiser, para mostrar à nutricionista ou à personal.
- **Exportar para o calendário (Agenda):** cria um arquivo .ics com os próximos 12 meses de tarefas (as que se repetem viram regra de repetição, com alarme do lembrete), cronograma capilar, contas, horários de refeição e treinos planejados, para abrir no Google Agenda ou no Calendário da Apple. É uma cópia de hoje: o que mudar depois no J.S. não muda no calendário.

## 3.6 Dados: backup automático, versões e lixeira

- **Backup automático cifrado (Configurações):** o app cria um **código de recuperação de 16 caracteres** (guardado só no aparelho; você precisa confirmar que anotou) e envia sozinho uma cópia cifrada dos seus dados: a última e uma por dia nos últimos 7 dias. O servidor não consegue ler nada, e sem o código ninguém recupera. Não leva as fotos do corpo, a menos que você ligue "Incluir fotos" (até cerca de 12 MB). Faz o backup ao abrir o app (se passou 1 dia e algo mudou) e depois de mudanças. Num aparelho novo: Início → **Restaurar backup automático** → digite o código. Ligado pelo flag `backup` em `js/config.js` (o servidor — `supabase/sql/05_backup_auto.sql` e as rotas `backup-*` da função `js-push` — está publicado desde a 2.8.1). **Não é sincronização ao vivo**: é backup e restauração (mesclar dois aparelhos em tempo real traria de volta o que foi apagado).
- **Versões e lixeira (Configurações):** uma foto dos dados por dia (14 dias) e uma cópia de segurança antes de restaurar, importar ou apagar tudo (30 dias), só neste aparelho. **Recuperar o que foi apagado** mostra o que existia e sumiu nos últimos 7 dias e traz de volta item por item, sem duplicar. **Voltar tudo** leva o app a um dia, com confirmação e cópia de segurança antes.

## 4. Notificações

- **Tudo com horário avisa por padrão:** ao pôr a hora numa tarefa, o lembrete vira "15 min antes"; num tratamento, "na hora". Refeições avisam na hora e contas 1 dia antes e no dia. Dá para mudar ou desligar em cada item. Itens antigos sem lembrete aparecem num aviso no painel e em Configurações, com o botão **Ligar todos**.
- O J.S. pede permissão na primeira vez que você cria um lembrete. Se você responder "Agora não", ele só volta a perguntar depois de 7 dias. Também dá para ativar em **Configurações**.
- **Sem o servidor**, os avisos aparecem enquanto o app está aberto ou em segundo plano. Ao abrir o app, os lembretes das últimas 2 horas aparecem, e as pendências atrasadas ficam no painel.
- **Com "Avisos com o app fechado" ligado** (Configurações → Notificações), os avisos chegam na hora **mesmo com o app fechado**. Ao permitir as notificações, o app oferece ligar isso uma vez.
- Funcionam melhor no Android com Chrome. No iPhone, só com o app instalado na tela de início (iOS 16.4 ou mais novo).
- Por privacidade, o valor das contas não aparece na notificação. Isso pode ser ligado em Configurações.
- **Skincare** avisa nos horários escolhidos no cartão (interruptor em Configurações → Notificações).
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
supabase db query --linked -f supabase/sql/04_transferencia.sql        # passar para outro aparelho (só na primeira vez)
supabase db query --linked -f supabase/sql/05_backup_auto.sql          # backup automático cifrado (só na primeira vez)
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

As regras de negócio têm testes automáticos. `regras.test.js` cobre recorrência, centavos, contas recorrentes, lembretes e backup. `v2.test.js` cobre fichas, troca do dia, execução, evolução de carga, corpo, TACO, cardápio, tarefa em andamento, o reconhecimento do toque atrás com sinais simulados, os treinos prontos e os desenhos de todos os exercícios. `v28-*.test.js` cobrem a sugestão de carga e o treino pelo ciclo, sono e skincare, Jardim e Resumo, cardápio da semana e lista de compras, o interpretador de frases, o PDF e o .ics, e o backup cifrado e as versões. `v27.test.js` cobre os recordes pessoais (carga, repetições, treino em andamento, ordem por data), a meta de proteína e as refeições salvas. `v26.test.js` cobre água (meta, lembretes inteligentes), ciclo menstrual (médias, fases, previsões, atraso, registros), séries por grupo muscular, favoritos e repetir refeição.

```
node --test testes/*.test.js
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
├── css/v26.css             água, ciclo, fotos, busca e as outras novidades da 2.6/2.7
├── css/treino28.css, jardim.css, planejador.css, ferramentas.css, dados.css, bemestar.css   estilos da 2.8
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
│   ├── slots.js            pontos de encaixe das telas e eventos (cada recurso novo se registra aqui)
│   ├── regras-bemestar.js, regras-planejador.js   sono/skincare e cardápio da semana (testadas)
│   ├── falar.js, pdf.js, ics.js                   frases em português, PDF sem bibliotecas e .ics (testados)
│   ├── jardim.js, cartoes.js, barras.js, relatorio.js, backup-auto.js, versoes.js   Jardim, cartões, código de barras, relatório, backup e versões
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
│                           corpo, ciclo, busca (busca geral e "Entendi"), bemestar (sono e skincare), resumo, planejador, financeiro, graficos, mais, agenda, config
├── supabase/
│   ├── functions/js-push/  servidor de avisos (Edge Function)
│   └── sql/                tabelas e agendamento a cada minuto
└── testes/                 regras, v2, v26, v27 e v28-* (treino, bemestar, jardim, planejador, ferramentas, dados)
```

A especificação original está em `../JS_Starter/docs/`.

## 8. Fora desta versão

- Sincronização ao vivo entre aparelhos (o app não guarda registro de exclusões; mesclar traria de volta o que foi apagado). Hoje há backup automático, passagem de dados por código e backup em arquivo.
- Widget na tela inicial, importar dados do Apple Saúde ou Google Fit e aviso exato de fim de descanso com o app fechado: um app instalado pela internet não consegue.
- Registrar série com o iPhone totalmente fechado (precisaria de um Atalho do iOS chamando o servidor de avisos, com uma fila de toques que o app aplica ao abrir).
