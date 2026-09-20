from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import win32com.client


root = Path(__file__).resolve().parents[1]
docx_path = root / "output" / "doc" / "巧裁-软件创意设计文档.docx"
pdf_path = root / "output" / "doc" / "巧裁-软件创意设计文档.pdf"

def export_pdf(source: Path, destination: Path) -> None:
    word_executable = Path(r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE")
    word_process = None
    if word_executable.exists():
        # WPS may replace the Word.Application registry entry. Launch the real
        # Microsoft Word automation server first, then attach to that instance.
        word_process = subprocess.Popen(
            [str(word_executable), "/automation"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2)
        word = win32com.client.GetActiveObject("Word.Application")
    else:
        word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    document = None
    try:
        document = word.Documents.Open(str(source.resolve()), ReadOnly=True)
        document.ExportAsFixedFormat(str(destination.resolve()), 17)
    finally:
        if document is not None:
            document.Close(False)
        try:
            word.Quit()
        except Exception:
            # WPS/Word may close its COM server immediately after exporting.
            pass
        if word_process is not None:
            try:
                word_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                word_process.terminate()


try:
    export_pdf(docx_path, pdf_path)
except Exception:
    # Some WPS versions register themselves as Word.Application but fail to
    # open paths containing CJK characters. Export through a short ASCII path.
    with tempfile.TemporaryDirectory(prefix="qiaocai-doc-") as temp_dir:
        temp_root = Path(temp_dir)
        temp_docx = temp_root / "design.docx"
        temp_pdf = temp_root / "design.pdf"
        shutil.copy2(docx_path, temp_docx)
        export_pdf(temp_docx, temp_pdf)
        shutil.copy2(temp_pdf, pdf_path)

print(pdf_path)
