import sqlite3

conn = sqlite3.connect('lexo.db')
cursor = conn.cursor()

# Tablo isimlerini kontrol et
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("All tables:")
for table in tables:
    print(f"  {table[0]}")

print("\nTables with stats/game/history in name:")
for table in tables:
    table_name = table[0]
    if 'stat' in table_name.lower() or 'game' in table_name.lower() or 'history' in table_name.lower():
        print(f"  {table_name}")
        
        # Bu tablodaki kayıt sayısını kontrol et
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        print(f"    Records: {count}")

conn.close()
