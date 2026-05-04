from PyQt5.QtWidgets import QWidget, QGridLayout, QLabel

class DataPanel(QWidget):
    def __init__(self):
        super().__init__()

        self.layout = QGridLayout()
        self.setLayout(self.layout)

        self.depth = QLabel("Depth: 0 cm")
        self.heading = QLabel("Heading: 0°")
        self.status = QLabel("System: OK")

        self.layout.addWidget(self.depth, 0, 0)
        self.layout.addWidget(self.heading, 0, 1)
        self.layout.addWidget(self.status, 1, 0)