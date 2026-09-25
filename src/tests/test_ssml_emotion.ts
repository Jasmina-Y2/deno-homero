import { googleTtsService } from "../service/googleTts.service.ts";

const ssmlAoede = `
<speak>
  <prosody pitch="+5st" rate="110%">
    <emphasis level="strong">¡No, no, por favor no entres ahí!</emphasis>
  </prosody>
  <break time="600ms"/>
  <prosody pitch="-3st" rate="85%" volume="soft">
    (llorando) Te lo suplico... escuché unos susurros horribles detrás de la pared...
  </prosody>
  <break time="500ms"/>
  <prosody pitch="+4st" rate="115%">
    ¡Jajajajaja! <emphasis level="moderate">¡Ay, no puedo más con la risa!</emphasis> ¡Era una broma!
  </prosody>
</speak>
`;

const buffer = await googleTtsService.synthesizeSpeech({
  ssml: ssmlAoede,
  voiceName: "es-US-Journey-F",
  audioEncoding: "MP3",
});

console.log("SSML Synthesized successfully! Buffer bytes:", buffer.length);

const res = await googleTtsService.synthesizeAndUpload({
  ssml: ssmlAoede,
  voiceName: "es-US-Journey-F",
  folder: "HISTORIA",
  fileName: "demo_emociones_ssml",
});

console.log("Uploaded SSML Demo URL:", res.url);
