"""Small reporting helpers shared by the local demonstrations."""
from datetime import datetime, timezone
from html import escape
import json
from pathlib import Path


def utc(value):
    """Require timezone-aware ISO timestamps, normalize to UTC."""
    result = datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
    if not isinstance(result, datetime) or result.tzinfo is None or result.utcoffset() is None:
        raise ValueError("A timezone-aware timestamp is required")
    return result.astimezone(timezone.utc)


def iso(value):
    return utc(value).isoformat().replace("+00:00", "Z")


def page(title, introduction, sections):
    return f'''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title><style>
*{{box-sizing:border-box}}body{{font:16px/1.6 system-ui,sans-serif;background:#edf2f6;color:#182b3a;margin:0}}
main{{max-width:1100px;margin:auto;padding:40px 24px}}h1{{font-size:36px;line-height:1.15}}h2{{margin-top:32px}}
section{{background:white;border:1px solid #d3dfe6;border-radius:12px;padding:20px;margin:20px 0}}
table{{width:100%;border-collapse:collapse}}th,td{{padding:10px;border-bottom:1px solid #dde4e9;text-align:left;vertical-align:top}}
th{{background:#f1f5f8}}.scroll{{overflow:auto}}code{{font-size:13px;word-break:break-word}}
footer{{font-size:13px;color:#526677}}a{{color:#005e86}}</style>
<main><p>FELIX K. NDEGWA / PORTFOLIO DEMONSTRATION</p><h1>{escape(title)}</h1>
<p>{escape(introduction)}</p>{sections}<footer>Synthetic sample data. Local demonstration; no live employer systems or customer records.</footer></main></html>'''


def table(headers, rows):
    heading = "".join(f"<th>{escape(str(x))}</th>" for x in headers)
    body = "".join("<tr>" + "".join(f"<td>{escape(str(v))}</td>" for v in row) + "</tr>" for row in rows)
    return f'<div class="scroll"><table><thead><tr>{heading}</tr></thead><tbody>{body}</tbody></table></div>'


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
