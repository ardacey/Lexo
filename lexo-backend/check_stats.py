import sqlite3

conn = sqlite3.connect('lexo.db')
cursor = conn.cursor()

print("=== USER_STATS ===")
cursor.execute("SELECT * FROM user_stats;")
rows = cursor.fetchall()
cursor.execute("PRAGMA table_info(user_stats);")
columns = [col[1] for col in cursor.fetchall()]
print("Columns:", columns)
for row in rows:
    print(dict(zip(columns, row)))

print("\n=== GAME_HISTORY ===")
cursor.execute("SELECT * FROM game_history;")
rows = cursor.fetchall()
cursor.execute("PRAGMA table_info(game_history);")
columns = [col[1] for col in cursor.fetchall()]
print("Columns:", columns)
for row in rows:
    print(dict(zip(columns, row)))

print("\n=== WORD_HISTORY ===")
cursor.execute("SELECT * FROM word_history;")
rows = cursor.fetchall()
cursor.execute("PRAGMA table_info(word_history);")
columns = [col[1] for col in cursor.fetchall()]
print("Columns:", columns)
for row in rows:
    print(dict(zip(columns, row)))

print("\n=== USERS ===")
cursor.execute("SELECT * FROM users;")
rows = cursor.fetchall()
cursor.execute("PRAGMA table_info(users);")
columns = [col[1] for col in cursor.fetchall()]
print("Columns:", columns)
for row in rows:
    print(dict(zip(columns, row)))

conn.close()
