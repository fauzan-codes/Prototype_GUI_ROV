from PyQt5.QtWidgets import QMainWindow, QWidget, QVBoxLayout

from ui.topbar import TopBar
from ui.camera_panel import CameraPanel
from ui.data_panel import DataPanel

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("ROV GCS")
        self.setGeometry(100, 100, 1200, 800)

        # central widget
        self.central = QWidget()
        self.setCentralWidget(self.central)

        self.layout = QVBoxLayout()
        self.central.setLayout(self.layout)

        # ================= UI COMPONENT =================
        self.topbar = TopBar()
        self.camera = CameraPanel()
        self.data = DataPanel()

        # ================= ADD TO LAYOUT =================
        self.layout.addWidget(self.topbar)
        self.layout.addWidget(self.camera)
        self.layout.addWidget(self.data)