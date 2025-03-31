import Turndown from "turndown"
import { gfm } from "turndown-plugin-gfm"

export function toMarkdown(html: string) {
  return new Turndown().use(gfm).turndown(html)
}
