# ui/topbar.py
from PyQt5.QtWidgets import QWidget, QHBoxLayout, QVBoxLayout, QLabel
from PyQt5.QtCore import QTimer, QDateTime, Qt


class TopBar(QWidget):
    def __init__(self):
        super().__init__()

        self.setFixedHeight(80)

        self.setObjectName("topbar")
        self.setAttribute(Qt.WA_StyledBackground, True)

        # ================= MAIN LAYOUT =================
        self.layout = QHBoxLayout()
        self.layout.setContentsMargins(20, 10, 20, 10)
        self.setLayout(self.layout)

        # ================= LEFT =================
        left_layout = QVBoxLayout()

        title = QLabel("Seadiver Team")
        subtitle = QLabel("Universitas Negeri Surabaya")

        title.setStyleSheet("font-size: 24px; font-weight: 600; color: white;")
        subtitle.setStyleSheet("font-size: 16px; font-weight: 400; color: #8a92a1;")

        left_layout.addWidget(title)
        left_layout.addWidget(subtitle)

        # ================= CENTER =================
        center_layout = QVBoxLayout()
        center_layout.setAlignment(Qt.AlignCenter)

        self.date_label = QLabel()
        self.time_label = QLabel()

        self.date_label.setStyleSheet("color: #8a92a1; font-size: 12px;")
        self.time_label.setStyleSheet("color: white; font-size: 14px; font-weight: 500;")

        center_layout.addWidget(self.date_label, alignment=Qt.AlignCenter)
        center_layout.addWidget(self.time_label, alignment=Qt.AlignCenter)

        # ================= RIGHT =================
        right_layout = QHBoxLayout()

        self.status_dot = QLabel("●")
        self.status_text = QLabel("System Offline")

        self.status_dot.setStyleSheet("color: #ff4d4f; font-weight: 500; font-size: 13px;")
        self.status_text.setStyleSheet("color: #ff4d4f; font-weight: 500; font-size: 12px;")

        right_layout.addWidget(self.status_dot)
        right_layout.addWidget(self.status_text)

        # ================= ADD =================
        self.layout.addLayout(left_layout)
        self.layout.addStretch()
        self.layout.addLayout(center_layout)
        self.layout.addStretch()
        self.layout.addLayout(right_layout)

        # ================= TIMER =================
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_time)
        self.timer.start(1000)

        self.update_time()

    def update_time(self):
        now = QDateTime.currentDateTime()
        self.date_label.setText(now.toString("dddd, dd MMMM yyyy"))
        self.time_label.setText(now.toString("HH:mm:ss"))

    def set_status(self, online=True):
        if online:
            self.status_dot.setStyleSheet("color: #00c853; font-size: 13px;")
            self.status_text.setStyleSheet("color: #00c853; font-size: 12px;")
            self.status_text.setText("System Online")
        else:
            self.status_dot.setStyleSheet("color: #ff4d4f; font-size: 14px;")
            self.status_text.setStyleSheet("color: #ff4d4f; font-size: 13px;")
            self.status_text.setText("System Offline")