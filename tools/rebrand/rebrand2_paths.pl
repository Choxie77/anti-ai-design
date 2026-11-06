#!/usr/bin/perl
# Prints "old<TAB>new" for every tracked path (stdin, NUL separated) whose components still carry the old
# name. The leading `anti-design-skill` component (the repository subfolder) is kept.
use strict; use warnings;
$/ = "\0";
while (my $p = <STDIN>) {
  chomp $p;
  my @c = split m{/}, $p, -1;
  my $first = shift @c;
  for (@c) { s/anti-design/anti-ai-design/g; s/anti_design/anti_ai_design/g; s/Anti-Design/Anti-AI-Design/g; }
  my $n = join '/', $first, @c;
  print "$p\t$n\n" if $n ne $p;
}
