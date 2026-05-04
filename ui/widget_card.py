# ui/widget_card.py
from PyQt5.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel


class WidgetCard(QWidget):
    def __init__(self, title="Title"):
        super().__init__()

        self.setObjectName("card")

        # ================= MAIN LAYOUT =================
        self.main_layout = QVBoxLayout()
        self.setLayout(self.main_layout)

        # ================= HEADER =================
        self.header = QHBoxLayout()

        self.title = QLabel(title)
        self.title.setObjectName("cardTitle")

        self.header.addWidget(self.title)
        self.header.addStretch()

        # tempat controls (button dll)
        self.controls = QHBoxLayout()
        self.header.addLayout(self.controls)

        self.main_layout.addLayout(self.header)

        # ================= BODY =================
        self.body = QVBoxLayout()
        self.main_layout.addLayout(self.body)