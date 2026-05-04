from PyQt5.QtWidgets import QWidget, QHBoxLayout, QLabel

class TopBar(QWidget):
    def __init__(self):
        super().__init__()

        self.layout = QHBoxLayout()
        self.setLayout(self.layout)

        self.title = QLabel("ROV GROUND CONTROL STATION")
        self.status = QLabel("STATUS: DISCONNECTED")

        self.layout.addWidget(self.title)
        self.layout.addStretch()
        self.layout.addWidget(self.status)