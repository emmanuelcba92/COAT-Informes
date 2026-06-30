import os

path = r"e:\Proyectos con IA\Antigravity\Informes COAT\src\pages\AdminPage.jsx"
with open(path, 'rb') as f:
    data = f.read()

try:
    # First, try to see if it's already "correct" UTF-8 but containing the mojibake chars
    text = data.decode('utf-8')
    
    # Mojibake correction: many patterns
    replacements = {
        'Ã¡': 'á',
        'Ã©': 'é',
        'Ã­': 'í',
        'Ã³': 'ó',
        'Ãº': 'ú',
        'Ã±': 'ñ',
        'Ã“': 'Ó',
        'Ãš': 'Ú',
        'Ã ': 'Á',
        'Ã\x81': 'Á',
        'Ã\x8D': 'Í',
        'Ã\x89': 'É',
        'Ã\x93': 'Ó',
        'Ã\x9A': 'Ú',
        'Â¿': '¿',
        'Â¡': '¡'
    }
    
    for old, new in replacements.items():
        text = text.replace(old, new)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed AdminPage.jsx encoding with Python")
except Exception as e:
    print(f"Error: {e}")
