# ui/data_panel.py
from PyQt5.QtWidgets import QLabel
from ui.widget_card import WidgetCard


class DataPanel(WidgetCard):
    def __init__(self):
        super().__init__("Depth")

        self.value = QLabel("0 cm")
        self.value.setStyleSheet("""
            font-size: 28px;
            font-weight: bold;
            color: white;
        """)

        self.body.addWidget(self.value)

    def update_data(self, depth, heading):
        self.value.setText(f"{depth} cm")