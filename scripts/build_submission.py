from __future__ import annotations

import shutil
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "output" / "submission"
SCREENSHOTS = SUBMISSION / "screenshots"

SOURCE_DIRS = ("cloudfunctions", "packages", "tests", "scripts", "assets", "docs", "miniprogram")
SOURCE_FILES = (
    ".gitignore",
    "config.example.json",
    "package.json",
    "package-lock.json",
    "project.config.json",
    "tsconfig.json",
    "vitest.config.ts",
    "原创与第三方代码说明.md",
)
SKIP_PARTS = {"node_modules", ".snapshots", ".git", ".agents", "output", "tmp", "__pycache__"}


def should_include(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return not any(part in SKIP_PARTS for part in relative.parts)


def write_source_archive(destination: Path) -> int:
    prefix = "巧裁-完整源代码"
    count = 0
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for filename in SOURCE_FILES:
            path = ROOT / filename
            archive.write(path, f"{prefix}/{filename}")
            count += 1
        for dirname in SOURCE_DIRS:
            directory = ROOT / dirname
            for path in sorted(directory.rglob("*")):
                if not path.is_file() or not should_include(path):
                    continue
                relative = path.relative_to(ROOT).as_posix()
                archive.write(path, f"{prefix}/{relative}")
                count += 1
    return count


def write_qr_archive(destination: Path) -> None:
    preview = ROOT / "artifacts" / "antigravity-preview.png"
    image = Image.open(preview).convert("RGB")
    png_data = BytesIO()
    image.save(png_data, format="PNG", optimize=True)
    notice = (
        "当前为开发预览二维码，来自已上传的 1.0.3 当前代码，可能过期。"
        "小程序审核发布后，请替换为正式小程序码，再将二维码压缩包作为安装体验材料提交。"
    )
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        archive.writestr("巧裁-开发预览二维码-发布后替换.png", png_data.getvalue())
        archive.writestr("请先阅读.txt", notice.encode("utf-8"))


def main() -> None:
    SUBMISSION.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)

    copies = {
        ROOT / "artifacts" / "workbench-02-lshape.png": SCREENSHOTS / "01-参数模板录入L形.png",
        ROOT / "artifacts" / "workbench-05-profile-result.png": SCREENSHOTS / "02-异形排料方案比较.png",
        ROOT / "artifacts" / "workbench-06-profile-cut.png": SCREENSHOTS / "03-分步裁切指导.png",
        ROOT / "output" / "doc" / "巧裁-软件创意设计文档.pdf": SUBMISSION / "巧裁-软件创意设计文档.pdf",
        ROOT / "原创与第三方代码说明.md": SUBMISSION / "原创与第三方代码说明.md",
        ROOT / "assets" / "qiaocai-avatar-144.png": SUBMISSION / "巧裁-小程序头像-144x144.png",
        ROOT / "artifacts" / "upload-1.0.3.json": SUBMISSION / "开发版上传记录-1.0.3.json",
    }
    for source, destination in copies.items():
        shutil.copy2(source, destination)

    source_count = write_source_archive(SUBMISSION / "巧裁-完整源代码.zip")
    write_qr_archive(SUBMISSION / "巧裁-安装体验二维码-发布前临时预览.zip")
    print(f"Submission package refreshed; source archive contains {source_count} files.")


if __name__ == "__main__":
    main()
