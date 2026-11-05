use strict; use File::Find; use File::Basename;
my @p; find({wanted=>sub{ push @p,$File::Find::name if basename($_)=~/impeccable/i }, no_chdir=>1}, '.');
@p = sort { length($b) <=> length($a) } @p;   # deepest first
for my $path (@p){
  my $d=dirname($path); my $b=basename($path); my $n=$b;
  $n=~s/IMPECCABLE/ANTI_DESIGN/g; $n=~s/impeccable_/anti_design_/g; $n=~s/(?<=_)impeccable/anti_design/g;
  $n=~s/impeccable/anti-design/g; $n=~s/Impeccable/Anti-Design/g;
  next if $n eq $b; rename($path,"$d/$n") or die "rename $path: $!";
}
print scalar(@p)," paths renamed\n";
