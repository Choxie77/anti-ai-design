#!/usr/bin/perl -pi
# Brand rewrite: Impeccable -> Anti-Design. Order matters.
s{(https?)://(?:www\.)?impeccable\.style}{$1://anti-design.example}g;
s{Impeccable\.Style}{Anti-Design.Example}g;
s{impeccable\.style}{anti-design.example}g;
s{github\.com/pbakaus/impeccable}{github.com/OWNER/anti-design}g;
s{pbakaus/impeccable}{OWNER/anti-design}g;
s{/Users/bakaus/code/impeccable-second}{/Users/dev/code/anti-design-second}g;
s/IMPECCABLE/ANTI_DESIGN/g;
s/(?<=[A-Za-z0-9])Impeccable/AntiDesign/g;
s/Impeccable(?=[A-Z0-9_])/AntiDesign/g;
s/impeccable(?=[A-Z])/antiDesign/g;
s/impeccable_/anti_design_/g;
s/(?<=_)impeccable/anti_design/g;
s/impeccable/anti-design/g;
s/Impeccable/Anti-Design/g;
