import { ApiProperty } from "@nestjs/swagger";

export class NoteExtra {
  @ApiProperty({
    description: "body of the note",
    example: `
      <p>
        仁和寺に、ある法師、年よるまで石清水を拜まざりければ、心憂く覺えて、
        ある時思ひたちて、たゞ一人かちより詣でけり。
      </p>
      <p>
        極樂寺、高良などを拜みて、かばかりと心得て歸りにけり。
      </p>
      <p>
        さて傍の人に逢ひて、
        「年ごろ思ひつる事果たし侍りぬ。\
        聞きしにも過ぎて尊くこそおはしけれ。\
        そも參りたる人ごとに山へのぼりしは、何事かありけむ、\
        ゆかしかりしかど、神へまゐるこそ本意なれと思ひて、山までは見ず。」
        とぞいひける。
      </p>
      <p>
        すこしの事にも先達はあらまほしきことなり。
      </p>
    `,
  })
  readonly body: string;
}
