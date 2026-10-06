import React from "react";
import { C, Caption, Cells, Flash, Ring, Scene, Show, Sql, Stage, Tag, Text, Verdict, charX, useCues, useCurrentFrame, type Meta } from "videoviz";

export const meta: Meta = { kind: "video" };

export default function Video() {
  const f = useCurrentFrame();
  const S = useCues();
  const ids = ["hook", "proof", "question", "fix", "close"];
  const B: Record<string, number> = {};
  const N: Record<string, number> = {};
  ids.forEach((id, i) => {
    B[id] = S.beat(id);
    N[id] = i + 1 < ids.length ? S.beat(ids[i + 1]) : S.duration;
  });
  const q = (id: string, phrase: string) => S.at(phrase, S.beat(id));
  const h = { look: q("hook", "look the same"), arent: q("hook", "They aren't"), ask: q("hook", "Let's ask") };
  const pr = { select: q("proof", "Select"), one: q("proof", "One."), same: q("proof", "Same thing") };
  const qu = { weird: q("question", "weird stuff") };
  const fx = { id: q("fix", "real identity") };
  const cl = { source: q("close", "Two in the source."), here: q("close", "Two here.") };

  return (
    <Stage>
      <Scene from={B.hook} to={N.hook} shots={[{ at: 0, x: 960, y: 480, zoom: 1.22 }, { at: h.ask - 6, x: 960, y: 540, zoom: 1, dur: 70 }]}>
        <Tag x={620} y={470} text="Café" size={100} at={B.hook + 20} sub="id 1" subAt={h.arent} />
        <Tag x={1300} y={470} text="Cafe" size={100} at={B.hook + 28} sub="id 2" subAt={h.arent} />
        <Ring x={charX(620, 4, 3, 100)} y={470 - 14} r={40} at={h.look + 10} out={h.arent} />
      </Scene>

      <Scene from={B.proof} to={N.proof} shots={[{ at: 0, x: 940, y: 300, zoom: 1.2 }, { at: pr.same - 10, x: 960, y: 500, zoom: 1, dur: 60 }]}>
        <Sql x={180} y={200} w={1100} size={44} at={pr.select} title="the system" lines={["SELECT 'Café' = 'Cafe' AS same;"]} />
        <Show at={pr.one}>
          <Text x={1500} y={320} size={140} weight={700} color={C.white} anchor="middle">
            1
          </Text>
        </Show>
        <Cells x={300} y={620} chars="Café" at={pr.same} color={(i) => (i === 3 ? C.bad : C.live)} />
      </Scene>

      <Scene from={B.question} to={N.question} shots={[{ at: 0, x: 960, y: 500, zoom: 1.05 }]}>
        <Tag x={760} y={470} text="Café" size={100} at={B.question} />
        <Tag x={1160} y={470} text="Cafe" size={100} at={B.question} />
        <Flash at={qu.weird} color={C.bad} strength={0.14} />
      </Scene>
      <Caption text="same name?" em="same" emColor="bad" at={qu.weird} out={N.question - 10} />

      <Scene from={B.fix} to={N.fix} shots={[{ at: 0, x: 960, y: 520, zoom: 1.12 }]}>
        <Tag x={620} y={470} text="Café" size={100} at={B.fix} sub="id 1" subColor={f >= fx.id ? C.ok : C.mute} />
        <Tag x={1300} y={470} text="Cafe" size={100} at={B.fix} sub="id 2" subColor={f >= fx.id ? C.ok : C.mute} />
      </Scene>
      <Caption text="the id is the identity" em="id" emColor="ok" at={fx.id} out={N.fix - 10} />

      <Scene from={B.close} to={N.close} shots={[{ at: 0, x: 960, y: 500, zoom: 1 }]}>
        <Tag x={620} y={400} text="Café" size={100} at={B.close + 10} />
        <Tag x={1300} y={400} text="Cafe" size={100} at={B.close + 18} />
        <Verdict x={620} y={690} at={cl.source} ok r={34} />
        <Verdict x={1300} y={690} at={cl.here} ok r={34} />
      </Scene>
      <Caption text="two names, two rows" em="two rows" emColor="ok" at={cl.here} out={S.duration - 20} />
    </Stage>
  );
}
