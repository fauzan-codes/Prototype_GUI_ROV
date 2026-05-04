# ui/camera_panel.py
from PyQt5.QtWidgets import QLabel, QPushButton, QHBoxLayout, QCheckBox, QWidget, QVBoxLayout
from PyQt5.QtCore import Qt
from ui.widget_card import WidgetCard


class CameraPanel(WidgetCard):
    def __init__(self, title="Front Camera"):
        super().__init__(title)

        # ================= CONTROLS =================
        self.capture_btn = QPushButton("📷")
        self.record_btn = QPushButton("🎥")

        for btn in [self.capture_btn, self.record_btn]:
            btn.setFixedSize(32, 32)
            btn.setCursor(Qt.PointingHandCursor)
            btn.setStyleSheet("""
                QPushButton {
                    background: transparent;
                    color: #8a92a1;
                    border-radius: 6px;
                }
                QPushButton:hover {
                    background: rgba(255,255,255,0.05);
                    color: #00b8d4;
                }
            """)

        # SWITCH
        self.toggle = QCheckBox()
        self.toggle.setFixedWidth(40)

        # BADGE
        self.badge = QLabel("OFFLINE")
        self.badge.setAlignment(Qt.AlignCenter)
        self.badge.setFixedWidth(70)
        self.badge.setStyleSheet("""
            background: rgba(108,117,125,0.2);
            color: #8a92a1;
            border-radius: 10px;
            padding: 4px;
            font-size: 10px;
            font-weight: bold;
        """)

        # tambah ke header
        self.controls.addWidget(self.capture_btn)
        self.controls.addWidget(self.record_btn)
        self.controls.addWidget(self.toggle)
        self.controls.addWidget(self.badge)

        # ================= CAMERA FRAME =================
        self.frame = QWidget()
        self.frame.setStyleSheet("""
            background-color: #111820;
            border-radius: 8px;
        """)
        self.frame.setMinimumHeight(200)

        frame_layout = QVBoxLayout()
        frame_layout.setAlignment(Qt.AlignCenter)
        self.frame.setLayout(frame_layout)

        # placeholder
        self.placeholder = QLabel("📷\nCamera Offline")
        self.placeholder.setAlignment(Qt.AlignCenter)
        self.placeholder.setStyleSheet("""
            color: #8a92a1;
            font-size: 16px;
        """)

        frame_layout.addWidget(self.placeholder)

        self.body.addWidget(self.frame)

    # ================= STATUS =================
    def set_status(self, status="offline"):
        if status == "live":
            self.badge.setText("LIVE")
            self.badge.setStyleSheet("""
                background: rgba(0,255,100,0.15);
                color: #00ff88;
                border-radius: 10px;
                padding: 4px;
                font-size: 10px;
                font-weight: bold;
            """)
        elif status == "connecting":
            self.badge.setText("CONNECT")
            self.badge.setStyleSheet("""
                background: rgba(255,193,7,0.2);
                color: #ffc107;
                border-radius: 10px;
                padding: 4px;
                font-size: 10px;
                font-weight: bold;
            """)
        else:
            self.badge.setText("OFFLINE")