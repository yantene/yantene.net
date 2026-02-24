import { createHighlighterCoreSync, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import langBash from "shiki/langs/bash.mjs";
import langCss from "shiki/langs/css.mjs";
import langGo from "shiki/langs/go.mjs";
import langHtml from "shiki/langs/html.mjs";
import langJavascript from "shiki/langs/javascript.mjs";
import langJson from "shiki/langs/json.mjs";
import langMarkdown from "shiki/langs/markdown.mjs";
import langRuby from "shiki/langs/ruby.mjs";
import langRust from "shiki/langs/rust.mjs";
import langToml from "shiki/langs/toml.mjs";
import langTypescript from "shiki/langs/typescript.mjs";
import langYaml from "shiki/langs/yaml.mjs";
import themeGithubLight from "shiki/themes/github-light.mjs";
import { visit } from "unist-util-visit";
import type { Code, Root, RootContent } from "mdast";

let highlighter: HighlighterCore | undefined;

function getHighlighter(): HighlighterCore {
  if (!highlighter) {
    highlighter = createHighlighterCoreSync({
      themes: [themeGithubLight],
      langs: [
        langBash,
        langCss,
        langGo,
        langHtml,
        langJavascript,
        langJson,
        langMarkdown,
        langRuby,
        langRust,
        langToml,
        langTypescript,
        langYaml,
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighter;
}

function isCodeWithLang(node: RootContent): node is Code & { lang: string } {
  return (
    node.type === "code" &&
    node.lang !== null &&
    node.lang !== undefined &&
    node.lang !== ""
  );
}

function highlightNode(node: Code & { lang: string }): Code {
  if (!getHighlighter().getLoadedLanguages().includes(node.lang)) {
    return node;
  }

  const hast = getHighlighter().codeToHast(node.value, {
    lang: node.lang,
    theme: "github-light",
  });

  return {
    ...node,
    data: { ...node.data, hast } as Code["data"],
  };
}

export function highlightCodeBlocks(tree: Root): Root {
  // structuredClone で入力ツリーを保護したうえで、クローン内のノードを
  // visit 経由で変異させる。unist-util-visit の設計上 visitor は参照渡し
  // であるため、この変異はクローンに閉じており入力には影響しない。
  const cloned = structuredClone(tree);
  visit(cloned, "code", (node: Code) => {
    if (isCodeWithLang(node)) {
      node.data = highlightNode(node).data;
    }
  });
  return cloned;
}
