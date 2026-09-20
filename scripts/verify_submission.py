from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "output" / "submission"
SCREENSHOTS = SUBMISSION / "screenshots"
MAX_IMAGE_BYTES = 1_000_000


def verify() -> dict:
    errors: list[str] = []
    warnings: list[str] = []

    intro_path = SUBMISSION / "作品简介.txt"
    intro = intro_path.read_text(encoding="utf-8").strip()
    han_count = len(re.findall(r"[\u3400-\u9fff]", intro))
    if han_count > 400:
        errors.append(f"作品简介含 {han_count} 个汉字，超过 400 字限制")
    if len(intro) > 800:
        errors.append(f"作品简介共 {len(intro)} 个字符，超过 800 字限制")

    screenshot_results = []
    screenshot_paths = sorted(SCREENSHOTS.glob("*"))
    if len(screenshot_paths) != 3:
        errors.append(f"功能截图应为 3 张，当前为 {len(screenshot_paths)} 张")
    for path in screenshot_paths:
        try:
            with Image.open(path) as image:
                fmt = image.format
                size = image.size
        except Exception as exc:
            errors.append(f"无法读取截图 {path.name}: {exc}")
            continue
        if fmt not in {"PNG", "JPEG"}:
            errors.append(f"截图 {path.name} 格式为 {fmt}，不是 PNG/JPEG")
        if path.stat().st_size > MAX_IMAGE_BYTES:
            errors.append(f"截图 {path.name} 大于 1 MB")
        screenshot_results.append(
            {"file": path.name, "bytes": path.stat().st_size, "format": fmt, "size": size}
        )

    pdf_path = SUBMISSION / "巧裁-软件创意设计文档.pdf"
    with fitz.open(pdf_path) as document:
        pdf_pages = document.page_count
        pdf_text = "\n".join(page.get_text() for page in document)
    if pdf_pages < 1:
        errors.append("设计文档 PDF 没有有效页面")
    for phrase in ("作品概述", "图形录入", "测试与验证", "TDesign MiniProgram 1.16.1"):
        if phrase not in pdf_text:
            errors.append(f"设计文档 PDF 缺少预期内容：{phrase}")

    source_zip = SUBMISSION / "巧裁-完整源代码.zip"
    with zipfile.ZipFile(source_zip) as archive:
        source_names = archive.namelist()
        corrupt_source_entry = archive.testzip()
    if corrupt_source_entry:
        errors.append(f"源代码压缩包损坏：{corrupt_source_entry}")
    forbidden = ("node_modules/", ".snapshots/", "project.private.config.json", "/output/", "/tmp/")
    leaked_paths = [name for name in source_names if any(item in name.replace("\\", "/") for item in forbidden)]
    if leaked_paths:
        errors.append(f"源代码压缩包含不应提交的路径：{leaked_paths[:5]}")
    required_suffixes = (
        "/package.json",
        "/project.config.json",
        "/miniprogram/app.json",
        "/cloudfunctions/api/index.js",
        "/packages/core/src/index.ts",
        "/原创与第三方代码说明.md",
    )
    for suffix in required_suffixes:
        if not any(name.replace("\\", "/").endswith(suffix) for name in source_names):
            errors.append(f"源代码压缩包缺少：{suffix}")

    qr_zip = SUBMISSION / "巧裁-安装体验二维码-发布前临时预览.zip"
    with zipfile.ZipFile(qr_zip) as archive:
        qr_names = archive.namelist()
        corrupt_qr_entry = archive.testzip()
    if corrupt_qr_entry:
        errors.append(f"二维码压缩包损坏：{corrupt_qr_entry}")
    if not any(name.lower().endswith(".png") for name in qr_names):
        errors.append("二维码压缩包中没有 PNG 图片")

    video_files = list(SUBMISSION.glob("*.mp4"))
    if not video_files:
        warnings.append("尚未加入 MP4 演示视频（必须小于等于 5 分钟且不超过 150 MB）")
    if "待填写" in pdf_text:
        warnings.append("设计文档仍有团队、学校或成员待填写项")
    warnings.append("当前二维码为开发预览码，正式提交前应替换为发布后的小程序码")
    warnings.append("报名表尚未加入提交目录")

    return {
        "materialIntegrityPassed": not errors,
        "submissionComplete": not errors and not warnings,
        "intro": {"characters": len(intro), "hanCharacters": han_count},
        "screenshots": screenshot_results,
        "designPdf": {"pages": pdf_pages, "bytes": pdf_path.stat().st_size},
        "sourceArchive": {"files": len(source_names), "bytes": source_zip.stat().st_size},
        "qrArchive": {"files": len(qr_names), "bytes": qr_zip.stat().st_size},
        "errors": errors,
        "remaining": warnings,
    }


if __name__ == "__main__":
    result = verify()
    manifest_path = SUBMISSION / "材料校验结果.json"
    manifest_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["materialIntegrityPassed"] else 1)
