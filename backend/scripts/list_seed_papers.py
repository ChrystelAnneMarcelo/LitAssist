from pymongo import MongoClient
import os
from dotenv import load_dotenv
load_dotenv()
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'litassist')
client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
user = db.users.find_one({'email': 'dev_seed@example.com'})
if not user:
    print('Seed user not found')
else:
    user_id = user['id']
    projects = list(db.projects.find({'userId': user_id}))
    for p in projects:
        print('Project:', p['name'], p['id'])
        papers = list(db.papers.find({'projectId': p['id']}))
        print(f'  Papers: {len(papers)}')
        for pap in papers:
            print('   -', pap.get('title'), '|', pap.get('year'), '|', pap.get('doi'))
client.close()
