# ตอบฝั่งโค้ด ขั้นที่ 6 (9 พ.ย. 13:5x เธอเลือก: ป้ายแดงตามที่เสนอ + ใบ้ ข ใบ้อ้อมขึ้น)

```
Phase 6 feedback (approved by her):

1) Arrange tab red label / yuck face on desserts and drinks: do NOT show it while placing. Only warn when the finished arrangement is NOT a secret combo and contains a dessert/drink (that is the only case that yucks, per GDD). Combos like afternoon_tea, strawberry_fever, full_meal, sweet_corn_pair, perfect_match need desserts/drinks, so an always-on red label tells players they cannot use them.

2) Replace the 15 set hints in src/i18n/th.json (news.set_hint.*) with these vaguer ones (half the recipe, player guesses the rest):
rice_set: ได้ยินว่าแค่มีข้าวร้อน ๆ กับอะไรอีกจานบนถาดเล็ก ก็มีชื่อเรียกแล้วนะ
chili_veg: ลูกค้าบ่นว่าน้ำพริกเผ็ด ๆ ต้องมีอะไรเย็น ๆ กรุบ ๆ แกล้มด้วย ถึงจะครบถาดเล็ก
two_shrimp: มีคนอยากกินกุ้งสองแบบในถาดเล็กใบเดียว แบบไหนกับแบบไหนกันนะ
sweet_corn_pair: ข้าวโพดหวาน ๆ คู่กับข้าวโพดอีกแบบที่ดื่มได้ ได้ยินว่าเป็นถาดเล็กลับ ๆ เลย
afternoon_tea: ยามบ่ายอยากได้ของหวานสักจาน กับเครื่องดื่มอุ่น ๆ ที่หวานด้วยน้ำผึ้งเหมือนกัน
perfect_match: แฝดหมาป่าเคยบอกว่ามีของคู่หนึ่งที่เข้ากันที่สุดในโลก ลองนึกดูสิว่าพวกเขาชอบอะไร
mackerel_tray: ถาดกลางแบบบ้าน ๆ มีข้าว มีน้ำพริกที่ทำจากปลา แล้วก็ไข่อีกอย่าง… คิดถึงบ้านจัง
soup_omelet: ข้าวสวยกับแกงจืดร้อน ๆ ถ้ามีไข่หอม ๆ อีกจานในถาดกลาง ได้ยินว่ามีชื่อเรียกด้วย
happy_sea: ข้าวสวยหนึ่งจาน กับเพื่อนจากทะเลอีกสองตัว ใส่ถาดกลาง ได้ยินว่าทะเลจะยิ้มเลย
fish_trio: คนรักปลาว่าปลาทำได้ตั้งหลายแบบ ถ้าครบสามแบบในถาดกลางล่ะก็…
strawberry_fever: สตรอว์เบอร์รีจะเคี้ยวก็ได้ ตักก็ได้ ดื่มก็ได้ ครบสามแบบในถาดกลางเมื่อไหร่ ฟีเวอร์เลย!
full_samrab: สำรับแท้ ๆ ในถาดใหญ่ ต้องมีข้าว มีน้ำพริก แล้วก็… อีกสองอย่างอะไรนะ
sea_samrab: สำรับคนรักทะเลในถาดใหญ่ น้ำพริกก็ต้องทำจากของทะเลด้วยนะ
country_samrab: กับข้าวบ้านทุ่งในถาดใหญ่ มีแกงจืด มีไข่ แล้วก็ผักผัดอีกจาน กินกับข้าวสวยร้อน ๆ
full_meal: ถาดใหญ่ที่ครบตั้งแต่ข้าวยันของปิดท้าย เขาเรียกว่าครบมื้อ ลองจัดดูสิ

Everything else in phase 6 is fine as you decided (big-table window frame, table on the dirt plaza, Gio hints only for makeable sets, set-name popup position).
```
