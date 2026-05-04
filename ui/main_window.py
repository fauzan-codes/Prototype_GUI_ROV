# ui/main_windows.py
from PyQt5.QtWidgets import QMainWindow, QWidget, QGridLayout
from PyQt5.QtCore import QTimer
import random

from ui.topbar import TopBar
from ui.camera_panel import CameraPanel
from ui.data_panel import DataPanel


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("ROV GCS")
        self.setGeometry(100, 100, 1200, 800)

        # central
        self.central = QWidget()
        self.central.setObjectName("central")
        self.setCentralWidget(self.central)

        # layout
        self.layout = QGridLayout()
        self.central.setLayout(self.layout)
        self.layout.setContentsMargins(0, 0, 0, 0)
        self.layout.setSpacing(15)

        # components
        self.topbar = TopBar()
        self.cam_front = CameraPanel("Front Camera")
        self.cam_bottom = CameraPanel("Bottom Camera")
        self.data = DataPanel()

        # add
        self.layout.addWidget(self.topbar, 0, 0, 1, 4)
        self.layout.addWidget(self.cam_front, 1, 0, 1, 2)
        self.layout.addWidget(self.cam_bottom, 1, 2, 1, 2)
        self.layout.addWidget(self.data, 2, 0, 1, 1)

        # responsive
        self.layout.setRowStretch(1, 1)

        # timer
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_ui)
        self.timer.start(1000)

        # style global
        self.setStyleSheet("""
        QMainWindow {
            background-color: #1a222d;
        }

        QWidget#central {
            background-color: #1a222d;
        }

        #topbar {
            background-color: #222b36;
            border-bottom: 2px solid #303a4a;
        }

        #card {
            background-color: #222b36;
            border: 1px solid #303a4a;
            border-radius: 12px;
            padding: 12px;
        }

        #cardTitle {
            color: #8a92a1;
            font-size: 14px;
        }
        """)

    def update_ui(self):
        depth = random.randint(0, 200)
        self.data.update_data(depth, 0)