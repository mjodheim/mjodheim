package be.mjodheim.castellano;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private static final int BG = Color.rgb(255, 248, 231);
    private static final int INK = Color.rgb(35, 41, 54);
    private static final int MUTED = Color.rgb(103, 106, 114);
    private static final int RED = Color.rgb(190, 55, 55);
    private static final int GOLD = Color.rgb(233, 168, 52);
    private TextToSpeech tts;
    private boolean ttsReady;
    private final List<Item> items = new ArrayList<>();
    private boolean home = true;

    private static final class Item {
        final int id; final String level; final String es; final String fr;
        Item(int id, String level, String es, String fr) { this.id=id; this.level=level; this.es=es; this.fr=fr; }
    }

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        seed();
        tts = new TextToSpeech(this, this);
        showHome();
    }

    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(new Locale("es", "ES"));
            tts.setSpeechRate(0.86f);
            ttsReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED;
        }
    }

    @Override protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        if (!home) showHome(); else super.onBackPressed();
    }

    private void showHome() {
        home = true;
        LinearLayout root = root();
        root.addView(text("Castellano B1", 34, INK, true));
        root.addView(text("Castillan d'Espagne · A1 → B1", 16, MUTED, false));
        addGap(root, 16);

        LinearLayout panel = panel();
        int seen = seenCount();
        int mastered = masteredCount();
        panel.addView(text("Progression", 15, RED, true));
        panel.addView(text(mastered + " phrases solides", 26, INK, true));
        panel.addView(text(seen + " vues sur " + items.size(), 14, MUTED, false));
        ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(items.size()); bar.setProgress(mastered);
        bar.setProgressTintList(android.content.res.ColorStateList.valueOf(GOLD));
        panel.addView(bar);
        root.addView(panel);
        addGap(root, 14);

        Button session = primary("Commencer la séance du jour");
        session.setOnClickListener(v -> startSession());
        root.addView(session); addGap(root, 9);

        Button path = secondary("Voir le parcours A1 / A2 / B1");
        path.setOnClickListener(v -> showPath());
        root.addView(path); addGap(root, 9);

        Button reset = secondary("Réinitialiser la progression");
        reset.setOnClickListener(v -> { getPreferences(MODE_PRIVATE).edit().clear().apply(); showHome(); });
        root.addView(reset);
        addGap(root, 24);
        root.addView(text("Méthode", 18, INK, true));
        root.addView(text("Lis la phrase espagnole à voix haute, écoute-la, puis révèle le français. Indique ensuite si elle était difficile ou facile : l'application garde ta progression sur le téléphone.", 15, MUTED, false));
        set(root);
    }

    private void showPath() {
        home = false;
        LinearLayout root = root();
        back(root, "Parcours");
        addLevel(root, "A1", "Besoins immédiats, logement, achats, déplacements.");
        addLevel(root, "A2", "Vie quotidienne, santé, travail, démarches.");
        addLevel(root, "B1", "Opinion, récit, projets et problèmes pratiques.");
        set(root);
    }

    private void addLevel(LinearLayout root, String level, String subtitle) {
        addGap(root, 12);
        LinearLayout panel = panel();
        int total = 0, mastered = 0;
        for (Item i : items) if (i.level.equals(level)) { total++; if (score(i) >= 3) mastered++; }
        panel.addView(text(level + "  ·  " + mastered + "/" + total, 23, INK, true));
        panel.addView(text(subtitle, 14, MUTED, false));
        Button b = secondary("Travailler ce niveau");
        b.setOnClickListener(v -> startLevel(level));
        panel.addView(b);
        root.addView(panel);
    }

    private void startSession() {
        List<Item> session = new ArrayList<>();
        for (Item i : items) if (score(i) < 3) session.add(i);
        if (session.isEmpty()) session.addAll(items);
        Collections.shuffle(session);
        if (session.size() > 12) session = new ArrayList<>(session.subList(0, 12));
        showCard(session, 0, "Séance du jour");
    }

    private void startLevel(String level) {
        List<Item> session = new ArrayList<>();
        for (Item i : items) if (i.level.equals(level)) session.add(i);
        Collections.shuffle(session);
        showCard(session, 0, "Niveau " + level);
    }

    private void showCard(List<Item> session, int index, String title) {
        home = false;
        if (index >= session.size()) { done(session.size()); return; }
        Item item = session.get(index);
        LinearLayout root = root();
        back(root, title);
        root.addView(text((index + 1) + " / " + session.size() + "   ·   " + item.level, 14, MUTED, false));
        addGap(root, 20);

        LinearLayout card = panel();
        TextView es = text(item.es, 28, INK, true); es.setGravity(Gravity.CENTER);
        card.addView(es); addGap(card, 14);
        Button listen = secondary("Écouter");
        listen.setOnClickListener(v -> speak(item.es));
        card.addView(listen);
        root.addView(card); addGap(root, 14);

        Button reveal = primary("Révéler la traduction");
        root.addView(reveal);
        LinearLayout answer = new LinearLayout(this); answer.setOrientation(LinearLayout.VERTICAL); answer.setVisibility(View.GONE);
        addGap(answer, 14);
        TextView fr = text(item.fr, 19, INK, false); fr.setGravity(Gravity.CENTER); answer.addView(fr);
        addGap(answer, 14);
        answer.addView(text("Comment était ta réponse ?", 14, MUTED, false));
        addGap(answer, 8);
        LinearLayout row = new LinearLayout(this); row.setOrientation(LinearLayout.HORIZONTAL);
        Button hard = gradeButton("À revoir", Color.rgb(157, 66, 66));
        Button good = gradeButton("Bien", Color.rgb(61, 125, 91));
        Button easy = gradeButton("Facile", Color.rgb(64, 103, 151));
        row.addView(hard, weight()); gapH(row); row.addView(good, weight()); gapH(row); row.addView(easy, weight());
        answer.addView(row); root.addView(answer);
        reveal.setOnClickListener(v -> { reveal.setVisibility(View.GONE); answer.setVisibility(View.VISIBLE); });
        hard.setOnClickListener(v -> grade(item, 0, session, index, title));
        good.setOnClickListener(v -> grade(item, 2, session, index, title));
        easy.setOnClickListener(v -> grade(item, 4, session, index, title));
        set(root);
    }

    private void grade(Item item, int value, List<Item> session, int index, String title) {
        getPreferences(MODE_PRIVATE).edit().putInt("score_" + item.id, value).putBoolean("seen_" + item.id, true).apply();
        showCard(session, index + 1, title);
    }

    private void done(int count) {
        LinearLayout root = root();
        back(root, "Séance terminée"); addGap(root, 30);
        TextView h = text("¡Muy bien!", 40, RED, true); h.setGravity(Gravity.CENTER); root.addView(h);
        TextView p = text(count + " phrases travaillées. Reviens demain pour renforcer celles qui restent fragiles.", 17, MUTED, false); p.setGravity(Gravity.CENTER); root.addView(p);
        addGap(root, 22);
        Button b = primary("Retour à l'accueil"); b.setOnClickListener(v -> showHome()); root.addView(b);
        set(root);
    }

    private void speak(String value) {
        if (!ttsReady) { Toast.makeText(this, "Voix espagnole indisponible sur cet appareil.", Toast.LENGTH_SHORT).show(); return; }
        tts.speak(value, TextToSpeech.QUEUE_FLUSH, null, "es-card");
    }

    private int score(Item i) { return getPreferences(MODE_PRIVATE).getInt("score_" + i.id, 0); }
    private int seenCount() { int c=0; for (Item i:items) if (getPreferences(MODE_PRIVATE).getBoolean("seen_"+i.id,false)) c++; return c; }
    private int masteredCount() { int c=0; for (Item i:items) if (score(i)>=3) c++; return c; }

    private LinearLayout root() {
        LinearLayout r = new LinearLayout(this); r.setOrientation(LinearLayout.VERTICAL); r.setPadding(dp(22),dp(26),dp(22),dp(34)); r.setBackgroundColor(BG); return r;
    }
    private LinearLayout panel() {
        LinearLayout p = new LinearLayout(this); p.setOrientation(LinearLayout.VERTICAL); p.setPadding(dp(18),dp(18),dp(18),dp(18)); p.setBackground(round(Color.WHITE,18,Color.TRANSPARENT,0)); return p;
    }
    private TextView text(String s,int size,int color,boolean bold) { TextView v=new TextView(this); v.setText(s); v.setTextSize(size); v.setTextColor(color); v.setLineSpacing(0,1.12f); if(bold)v.setTypeface(Typeface.DEFAULT_BOLD); return v; }
    private Button primary(String s) { Button b=base(s); b.setTextColor(Color.WHITE); b.setBackground(round(RED,15,RED,0)); return b; }
    private Button secondary(String s) { Button b=base(s); b.setTextColor(INK); b.setBackground(round(Color.WHITE,15,Color.rgb(224,214,194),1)); return b; }
    private Button gradeButton(String s,int color) { Button b=base(s); b.setTextSize(13); b.setTextColor(Color.WHITE); b.setBackground(round(color,13,color,0)); return b; }
    private Button base(String s) { Button b=new Button(this); b.setText(s); b.setAllCaps(false); b.setTextSize(16); b.setMinHeight(dp(52)); b.setPadding(dp(10),dp(10),dp(10),dp(10)); return b; }
    private void back(LinearLayout root,String title) { Button b=new Button(this); b.setText("← Accueil"); b.setAllCaps(false); b.setTextColor(RED); b.setBackgroundColor(Color.TRANSPARENT); b.setGravity(Gravity.START); b.setPadding(0,0,0,0); b.setOnClickListener(v->showHome()); root.addView(b); root.addView(text(title,30,INK,true)); }
    private void set(LinearLayout root) { ScrollView s=new ScrollView(this); s.setFillViewport(true); s.addView(root); setContentView(s); }
    private void addGap(LinearLayout root,int value) { View v=new View(this); v.setLayoutParams(new LinearLayout.LayoutParams(1,dp(value))); root.addView(v); }
    private void gapH(LinearLayout row) { View v=new View(this); v.setLayoutParams(new LinearLayout.LayoutParams(dp(6),1)); row.addView(v); }
    private LinearLayout.LayoutParams weight(){ return new LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f); }
    private GradientDrawable round(int fill,int radius,int stroke,int width){ GradientDrawable g=new GradientDrawable(); g.setColor(fill); g.setCornerRadius(dp(radius)); if(width>0)g.setStroke(dp(width),stroke); return g; }
    private int dp(int v){ return Math.round(v*getResources().getDisplayMetrics().density); }

    private void seed() {
        String[][] d = {
            {"A1","Hola, ¿qué tal?","Bonjour, comment ça va ?"},
            {"A1","Me llamo Anthony.","Je m'appelle Anthony."},
            {"A1","Perdona, no entiendo.","Pardon, je ne comprends pas."},
            {"A1","Somos de Bélgica.","Nous sommes de Belgique."},
            {"A1","Busco una casa para alquilar.","Je cherche une maison à louer."},
            {"A1","¿Cuánto cuesta al mes?","Combien cela coûte-t-il par mois ?"},
            {"A1","¿Están incluidos los gastos?","Les charges sont-elles comprises ?"},
            {"A1","Necesitamos espacio para los animales.","Nous avons besoin d'espace pour les animaux."},
            {"A1","Quiero un café, por favor.","Je voudrais un café, s'il vous plaît."},
            {"A1","¿Aceptan tarjeta?","Acceptez-vous la carte ?"},
            {"A1","La cuenta, por favor.","L'addition, s'il vous plaît."},
            {"A1","¿Dónde está la estación?","Où est la gare ?"},
            {"A1","Cogemos el autobús.","Nous prenons le bus."},
            {"A1","Está a diez minutos andando.","C'est à dix minutes à pied."},
            {"A1","¿Hay aparcamiento cerca?","Y a-t-il un parking à proximité ?"},
            {"A2","Normalmente me levanto a las siete.","Normalement, je me lève à sept heures."},
            {"A2","Todavía no he terminado.","Je n'ai pas encore terminé."},
            {"A2","Antes vivía en otra ciudad.","Avant, je vivais dans une autre ville."},
            {"A2","Quisiera pedir cita con el médico.","Je voudrais prendre rendez-vous chez le médecin."},
            {"A2","¿Hay una farmacia de guardia?","Y a-t-il une pharmacie de garde ?"},
            {"A2","Trabajo como desarrollador web.","Je travaille comme développeur web."},
            {"A2","Estoy buscando trabajo en España.","Je cherche du travail en Espagne."},
            {"A2","¿El puesto permite teletrabajo?","Le poste permet-il le télétravail ?"},
            {"A2","Me gustaría saber más sobre el puesto.","J'aimerais en savoir plus sur le poste."},
            {"A2","Necesito empadronarme en el municipio.","Je dois m'inscrire au registre municipal."},
            {"A2","¿Qué documentos tengo que traer?","Quels documents dois-je apporter ?"},
            {"A2","¿Puedo hacer el trámite por internet?","Puis-je effectuer la démarche en ligne ?"},
            {"A2","Nunca he estado en Galicia.","Je ne suis jamais allé en Galice."},
            {"A2","¿Qué me recomiendas visitar?","Que me recommandes-tu de visiter ?"},
            {"A2","Lo pasamos muy bien.","Nous avons passé un très bon moment."},
            {"B1","En mi opinión, vivir cerca del mar mejora la calidad de vida.","À mon avis, vivre près de la mer améliore la qualité de vie."},
            {"B1","No creo que sea tan sencillo.","Je ne pense pas que ce soit si simple."},
            {"B1","Aunque no sea perfecto, me parece una buena opción.","Même si ce n'est pas parfait, cela me semble une bonne option."},
            {"B1","Cuando llegamos, ya había empezado a llover.","Quand nous sommes arrivés, il avait déjà commencé à pleuvoir."},
            {"B1","Nunca había visto un paisaje así.","Je n'avais jamais vu un paysage comme celui-là."},
            {"B1","Si todo va bien, nos mudaremos el año que viene.","Si tout se passe bien, nous déménagerons l'année prochaine."},
            {"B1","Cuando tengamos trabajo estable, buscaremos una casa.","Quand nous aurons un emploi stable, nous chercherons une maison."},
            {"B1","Me gustaría llegar a un nivel B1 antes de vivir en España.","J'aimerais atteindre le niveau B1 avant de vivre en Espagne."},
            {"B1","Cuanto más practique, más fácil me resultará hablar.","Plus je pratiquerai, plus il me sera facile de parler."},
            {"B1","Tenemos que entregar esta funcionalidad antes del viernes.","Nous devons livrer cette fonctionnalité avant vendredi."},
            {"B1","He encontrado un error que afecta a varios usuarios.","J'ai trouvé une erreur qui affecte plusieurs utilisateurs."},
            {"B1","La solución funciona, pero creo que podemos simplificarla.","La solution fonctionne, mais je pense que nous pouvons la simplifier."},
            {"B1","Todavía estoy investigando la causa del problema.","Je suis encore en train d'étudier la cause du problème."},
            {"B1","¿Podría enviarme la confirmación por correo electrónico?","Pourriez-vous m'envoyer la confirmation par e-mail ?"},
            {"B1","Llevamos dos semanas esperando una respuesta.","Cela fait deux semaines que nous attendons une réponse."}
        };
        for (int i=0;i<d.length;i++) items.add(new Item(i+1,d[i][0],d[i][1],d[i][2]));
    }
}
