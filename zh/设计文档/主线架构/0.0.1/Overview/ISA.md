该文件记录buckyball的通用指令，指令执行单元为memdomain和frontend。在llvm后端中为`+xbuckyballbase`管理。各个具体芯片在此基础上拓展各类ball指令。


| ISA   | Func7 | Rs1 | Rs2 |
| ----- | ----- | --- | --- |
| fence |       |     |     |
| mset  |       |     |     |
| mvin  |       |     |     |
| mvout |       |     |     |
|       |       |     |     |
