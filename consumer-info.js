(() => {
  window.appendConsumerInfo = (container, product) => {
    const record = window.CONSUMER_INFO?.[String(product.barcode).trim().padStart(14, '0')];
    if (!record) return;
    const panel = document.createElement('section');
    panel.className = 'product-field consumer-info';
    const heading = document.createElement('h2');
    heading.textContent = 'למה המוצר מיועד?';
    panel.append(heading);
    for (const text of [...new Set([record.purpose, record.description].filter(Boolean))]) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      panel.append(paragraph);
    }
    const note = document.createElement('p');
    note.className = 'detail-notice';
    note.textContent = 'מידע כללי על המוצר, ללא אבחון או התאמה אישית. לפני השימוש יש לעיין בתווית ובהוראות ובאזהרות שעל האריזה. לשאלות על התאמה אישית פנו לרוקח או לרוקחת.';
    panel.append(note);
    container.append(panel);
  };
})();
