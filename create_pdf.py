from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Trading Bot Documentation', 0, 1, 'C')
        self.ln(10)

    def chapter_title(self, title):
        self.set_font('Arial', 'B', 12)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 10, title, 0, 1, 'L', 1)
        self.ln(4)

    def chapter_body(self, body):
        self.set_font('Arial', '', 11)
        self.multi_cell(0, 10, body)
        self.ln()

pdf = PDF()
pdf.add_page()

pdf.chapter_title('Overview')
pdf.chapter_body('This is an automated trading bot that uses orderbook delta analysis to trade BTCUSDT on Binance.')

pdf.chapter_title('Strategy')
pdf.chapter_body('The bot uses a mean reversion strategy based on orderbook volume delta. It calculates the difference between bid and ask volumes at a specified depth and uses Bollinger Bands to identify entry points.')

pdf.chapter_title('Configuration')
pdf.chapter_body('Settings are configured in settings.json. Key parameters include market name, sampling time, Bollinger Band period and standard deviation, orderbook depth, and order sizing.')

pdf.chapter_title('Usage')
pdf.chapter_body('Run the bot by executing run_bot.bat. The bot will start sampling the orderbook and enter positions when the delta deviates significantly from the mean.')

pdf.output('trading_bot.pdf')
