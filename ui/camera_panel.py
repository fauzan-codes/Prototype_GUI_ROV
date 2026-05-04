from PyQt5.QtWidgets import QWidget, QVBoxLayout, QLabel

class CameraPanel(QWidget):
    def __init__(self):
        super().__init__()

        self.layout = QVBoxLayout()
        self.setLayout(self.layout)

        self.label = QLabel("CAMERA VIEW")
        self.label.setStyleSheet("background-color: black; color: white;")

        self.layout.addWidget(self.label)