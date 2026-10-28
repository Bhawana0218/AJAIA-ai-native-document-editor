import { stripJsComments } from "./strip-comments.mjs";

const cases = [
  {
    name: "comment-only line removed with newline; multi-line block collapses",
    input: "// hi\nconst a = 1; /* multi\nline */ const b = 2;\n",
    expect: "const a = 1;  const b = 2;\n",
  },
  {
    name: "urls in strings untouched",
    input: 'const u = "http://localhost:3000/x"; // note\n',
    expect: 'const u = "http://localhost:3000/x"; \n',
  },
  {
    name: "regex after = and after : (object)",
    input: "const RE = /^[0-9a-f]{8}$/i;\nconst ms = [{ re: /\\*\\*([^*]+)\\*\\*/g, mark: 'bold' }];\n",
    expect: "const RE = /^[0-9a-f]{8}$/i;\nconst ms = [{ re: /\\*\\*([^*]+)\\*\\*/g, mark: 'bold' }];\n",
  },
  {
    name: "division is not regex",
    input: "const x = Math.floor(diff / 60_000); // keep\n",
    expect: "const x = Math.floor(diff / 60_000); \n",
  },
  {
    name: "template literal with nested tpl and comment inside expr",
    input: "const s = `a ${ `inner ${ x /* t */ }` } // not a comment`;\n",
    expect: "const s = `a ${ `inner ${ x  }` } // not a comment`;\n",
  },
  {
    name: "jsx single-line comments in braces",
    input: "const el = (\n  <div>\n    {/* hidden note */}\n    <p>plain text</p>\n  </div>\n);\n",
    expect: "const el = (\n  <div>\n    {}\n    <p>plain text</p>\n  </div>\n);\n",
  },
  {
    name: "shebang preserved, following comment-only line removed",
    input: "#!/usr/bin/env node\n// strip\nimport fs from 'node:fs';\n",
    expect: "#!/usr/bin/env node\nimport fs from 'node:fs';\n",
  },
  {
    name: "regex after return",
    input: "function f() {\n  return /foo\\/bar/g.test(s);\n}\n",
    expect: "function f() {\n  return /foo\\/bar/g.test(s);\n}\n",
  },
  {
    name: "escaped quote in string with // inside",
    input: "const s = 'it\\'s // not a comment';\n",
    expect: "const s = 'it\\'s // not a comment';\n",
  },
  {
    name: "doc comment above export leaves no residue",
    input: "/** doc */\nexport const x = 1;\n",
    expect: "export const x = 1;\n",
  },
  {
    name: "CRLF trailing comment keeps line break",
    input: "const a = 1; // x\r\nconst b = 2;\r\n",
    expect: "const a = 1; \r\nconst b = 2;\r\n",
  },
  {
    name: "ASI: newline before comment preserved, after swallowed",
    input: "const y = 1\n/* c */ ++z;\n",
    expect: "const y = 1\n++z;\n",
  },
  {
    name: "comment between code on same line not swallowing code",
    input: "foo(/* c */ bar());\n",
    expect: "foo( bar());\n",
  },
];

let failed = 0;
for (const c of cases) {
  const got = stripJsComments(c.input);
  if (got !== c.expect) {
    failed++;
    console.log(`FAIL ${c.name}\n  got:    ${JSON.stringify(got)}\n  expect: ${JSON.stringify(c.expect)}`);
  } else {
    console.log(`ok   ${c.name}`);
  }
}
process.exitCode = failed ? 1 : 0;
